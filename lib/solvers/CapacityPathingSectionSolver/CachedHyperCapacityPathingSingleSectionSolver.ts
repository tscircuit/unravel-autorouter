import { CachableSolver, CacheProvider } from "lib/cache/types"
import { HyperCapacityPathingSingleSectionSolver } from "./HyperCapacityPathingSingleSectionSolver"
import { CapacityPathingSingleSectionPathingSolver } from "./CapacityPathingSingleSectionSolver"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CapacityMeshNodeId } from "lib/types"
import objectHash from "object-hash"
import {
  getGlobalLocalStorageCache,
  setupGlobalCaches,
} from "lib/cache/setupGlobalCaches"
import {
  translate,
  type Matrix,
  applyToPoint,
} from "transformation-matrix"

// Normalized IDs are simple strings like "node_0", "connection_1", etc.
type NormalizedId = string

// Helper function to round to nearest 50 microns (0.05 mm) and return as string
const approximateCoordinate = (coord: number): string => {
  // Multiply by 20 (1 / 0.05), round, then divide by 20
  // Use toFixed(2) to ensure consistent string format like "1.20" or "0.05"
  return (Math.round(coord * 20) / 20).toFixed(2)
}

interface CacheToHyperCapacityPathingTransform {
  realToCacheTransform: Matrix
  // Mappings from original UUIDs to normalized IDs
  nodeIdMap: Map<CapacityMeshNodeId, NormalizedId>
  // Reverse mappings from normalized IDs back to original UUIDs
  reverseNodeIdMap: Map<NormalizedId, CapacityMeshNodeId>
}

interface CachedSolvedHyperCapacityPathingSection {
  success: boolean
  // Store the winning solver's hyperParameters
  winningHyperParameters?: any
  // Store additional metadata if needed for reconstruction
  sectionScore?: number
}

setupGlobalCaches()

export class CachedHyperCapacityPathingSingleSectionSolver
  extends HyperCapacityPathingSingleSectionSolver
  implements
    CachableSolver<
      CacheToHyperCapacityPathingTransform,
      CachedSolvedHyperCapacityPathingSection
    >
{
  cacheHit = false
  cacheProvider: CacheProvider | null
  declare cacheToSolveSpaceTransform?:
    | CacheToHyperCapacityPathingTransform
    | undefined
  hasAttemptedToUseCache = false
  cacheKey?: string

  constructor(
    params: ConstructorParameters<
      typeof HyperCapacityPathingSingleSectionSolver
    >[0] & {
      cacheProvider?: CacheProvider | null
    },
  ) {
    super(params)
    this.cacheProvider =
      params.cacheProvider === undefined
        ? getGlobalLocalStorageCache() // Default to localStorage if undefined
        : params.cacheProvider // Use null if explicitly passed as null
  }

  _step() {
    if (!this.hasAttemptedToUseCache && this.cacheProvider) {
      if (this.attemptToUseCacheSync()) return
    }
    super._step()
    if ((this.solved || this.failed) && this.cacheProvider) {
      this.saveToCacheSync()
    }
  }

  computeCacheKeyAndTransform(): {
    cacheKey: string
    cacheToSolveSpaceTransform: CacheToHyperCapacityPathingTransform
  } {
    // 1. Calculate Transformation Matrix (currently just translation)
    const sectionNodes = this.sectionNodes
    const centerNode = sectionNodes.find(
      (node) => node.id === this.centerNodeId,
    )!

    // Create a transform that centers the problem at the origin
    const realToCacheTransform = translate(-centerNode.center.x, -centerNode.center.y)

    // 2. Create ID Mappings
    const nodeIdMap = new Map<CapacityMeshNodeId, NormalizedId>()
    const reverseNodeIdMap = new Map<NormalizedId, CapacityMeshNodeId>()

    let nodeCounter = 0

    // Sort node IDs for deterministic normalized IDs based on coordinates (x then y)
    const sortedNodeIds = [...sectionNodes.map((node) => node.id)].sort(
      (aNId, bNId) => {
        const n1 = sectionNodes.find((node) => node.id === aNId)!
        const n2 = sectionNodes.find((node) => node.id === bNId)!

        if (n1.center.x !== n2.center.x) {
          return n1.center.x - n2.center.x
        }
        return n1.center.y - n2.center.y
      },
    )
    for (const nodeId of sortedNodeIds) {
      const normId = `node_${nodeCounter++}`
      nodeIdMap.set(nodeId, normId)
      reverseNodeIdMap.set(normId, nodeId)
    }

    // 3. Create Normalized Structure for Hashing
    const normalizedNodes: Record<
      NormalizedId,
      {
        width: number
        height: number
        availableZ: number[]
        center: { x: string; y: string } // Coordinates are approximated strings
      }
    > = {}
    for (const [nodeId, normNodeId] of nodeIdMap.entries()) {
      const node = sectionNodes.find((n) => n.id === nodeId)!
      const transformedCenter = applyToPoint(realToCacheTransform, node.center)
      normalizedNodes[normNodeId] = {
        width: node.width,
        height: node.height,
        availableZ: node.availableZ,
        center: {
          x: approximateCoordinate(transformedCenter.x),
          y: approximateCoordinate(transformedCenter.y),
        },
      }
    }

    // Create a normalized version of the section terminals for hashing
    const normalizedConnectionTerminals = this.constructorParams.sectionConnectionTerminals.map(
      (terminal) => {
        const transformedPosition = applyToPoint(
          realToCacheTransform,
          terminal.position,
        )
        return {
          nodeId: nodeIdMap.get(terminal.nodeId)!,
          z: terminal.z,
          position: {
            x: approximateCoordinate(transformedPosition.x),
            y: approximateCoordinate(transformedPosition.y),
          },
          connectionName: terminal.connectionName,
        }
      },
    )

    // Hash the normalized data for cache key
    const keyData = {
      hyperParameters: this.constructorParams.hyperParameters,
      normalizedNodes,
      normalizedConnectionTerminals,
      // Include any other parameters that would affect the solution
    }

    const cacheKey = `hpercappsec:${objectHash(keyData)}`

    const cacheToSolveSpaceTransform: CacheToHyperCapacityPathingTransform = {
      realToCacheTransform,
      nodeIdMap,
      reverseNodeIdMap,
    }

    this.cacheKey = cacheKey
    this.cacheToSolveSpaceTransform = cacheToSolveSpaceTransform

    return { cacheKey, cacheToSolveSpaceTransform }
  }

  applyCachedSolution(
    cachedSolution: CachedSolvedHyperCapacityPathingSection,
  ): void {
    if (!cachedSolution.success) {
      this.failed = true
      return
    }

    // Create a solver with the winning hyperParameters from cache
    const winningSolver = this.generateSolver(
      cachedSolution.winningHyperParameters,
    )

    // Set it as the winning solver
    this.winningSolver = winningSolver

    // Mark the solver as successful
    this.cacheHit = true
    this.solved = true
  }

  attemptToUseCacheSync(): boolean {
    this.hasAttemptedToUseCache = true
    if (!this.cacheProvider?.isSyncCache) {
      console.log(
        "Cache provider is not synchronous, skipping sync cache check.",
      )
      return false
    }

    if (!this.cacheKey) {
      this.computeCacheKeyAndTransform()
    }

    if (!this.cacheKey) {
      console.error("Failed to compute cache key.")
      return false
    }

    try {
      const cachedSolution = this.cacheProvider.getCachedSolutionSync(
        this.cacheKey,
      )

      if (cachedSolution) {
        this.applyCachedSolution(
          cachedSolution as CachedSolvedHyperCapacityPathingSection,
        )
        return true
      }
    } catch (error) {
      console.error("Error attempting to use cache:", error)
    }

    return false
  }

  saveToCacheSync(): void {
    if (!this.cacheKey) {
      console.error("Cannot save to cache without cache key.")
      return
    }

    const cachedSolution: CachedSolvedHyperCapacityPathingSection = {
      success: !this.failed && !!this.winningSolver,
    }

    // If we have a winning solver, save its hyperParameters
    if (this.winningSolver) {
      cachedSolution.winningHyperParameters = this.winningSolver.hyperParameters
      cachedSolution.sectionScore = this.winningSolver.getSolvedSectionScore()
    }

    this.cacheProvider?.setCachedSolutionSync(this.cacheKey, cachedSolution)
  }
}