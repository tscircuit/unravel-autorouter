import { CachableSolver, CacheProvider } from "lib/cache/types"
import { HyperCapacityPathingSingleSectionSolver } from "./HyperCapacityPathingSingleSectionSolver"
import { CapacityPathingSingleSectionPathingSolver } from "./CapacityPathingSingleSectionSolver"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import objectHash from "object-hash"
import {
  getGlobalLocalStorageCache,
  setupGlobalCaches,
} from "lib/cache/setupGlobalCaches"
import { translate, type Matrix, applyToPoint } from "transformation-matrix"
import { getTunedTotalCapacity1 } from "lib/utils/getTunedTotalCapacity1"

type CacheSpaceNodeId = string

// A normalized connection id - note that the first id is always lower than the second
type CacheSpaceConnectionId = `${CacheSpaceNodeId}->${CacheSpaceNodeId}`

interface CacheToHyperCapacityPathingTransform {
  cacheSpaceToRealConnectionId: Map<CacheSpaceConnectionId, string>
  cacheSpaceToRealNodeId: Map<CacheSpaceNodeId, string>
}

type CachedSolvedHyperCapacityPathingSection =
  | { success: false }
  | {
      success: true
      sectionScore: number
      solutionPaths: Record<CacheSpaceConnectionId, CacheSpaceNodeId[]>
    }

const roundCapacity = (capacity: number) => Math.floor(capacity * 10) / 10

type CacheCapacity = string // "10.0", (number).toFixed(1)

interface CacheKeyContent {
  node_capacity_map: Record<CacheSpaceNodeId, CacheCapacity>
  node_edge_map: Array<[CacheSpaceNodeId, CacheSpaceNodeId]>
  terminals: Record<
    CacheSpaceConnectionId,
    {
      start: CacheSpaceNodeId
      end: CacheSpaceNodeId
    }
  >
}

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
  sectionNodeIdSet: Set<string>

  constructor(
    params: ConstructorParameters<
      typeof HyperCapacityPathingSingleSectionSolver
    >[0] & {
      cacheProvider?: CacheProvider | null
    },
  ) {
    params.nodeMap =
      params.nodeMap ??
      new Map(params.sectionNodes.map((n) => [n.capacityMeshNodeId, n]))
    super(params)
    this.sectionNodeIdSet = new Set(
      params.sectionNodes.map((sn) => sn.capacityMeshNodeId),
    )
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

  _computeBfsOrderingOfNodesInSection(): CapacityMeshNodeId[] {
    const seenNodeIds = new Set<string>(this.constructorParams.centerNodeId)
    const ordering: CapacityMeshNodeId[] = []

    const candidates: Array<{
      ancestorCapacitySum: number
      capacity: number
      g: number // ancestorCapacitySum + capacity
      capacityMeshNodeId: CapacityMeshNodeId
    }> = [
      {
        ancestorCapacitySum: 0,
        capacity: 0,
        g: 0,
        capacityMeshNodeId: this.constructorParams.centerNodeId,
      },
    ]
    // Run a breadth first search using the rounded capacity as a penalty for the ordering
    while (candidates.length > 0) {
      candidates.sort((a, b) => b.g - a.g)
      const candidate = candidates.pop()
      if (!candidate) break
      ordering.push(candidate.capacityMeshNodeId)

      // Add all the candidate's neighbors (if they are in the section)
      const neighborNodeIds = this.constructorParams
        .nodeEdgeMap!.get(candidate.capacityMeshNodeId)!
        .flatMap((edge) => edge.nodeIds)!
        .filter((nodeId) => !seenNodeIds.has(nodeId))
        .filter((nodeId) => this.sectionNodeIdSet.has(nodeId))

      for (const neighborNodeId of neighborNodeIds) {
        seenNodeIds.add(neighborNodeId)
        const neighbor = this.constructorParams.nodeMap!.get(neighborNodeId)!
        const capacity = getTunedTotalCapacity1(neighbor)
        candidates.push({
          ancestorCapacitySum: candidate.g,
          capacity,
          g: candidate.g + capacity,
          capacityMeshNodeId: neighborNodeId,
        })
      }
    }
    return ordering
  }

  computeCacheKeyAndTransform(): {
    cacheKey: string
    cacheToSolveSpaceTransform: CacheToHyperCapacityPathingTransform
  } {
    // The relevant information for computing a cache key is the connections between nodes in the section
    // and the capacities of all the nodes. All problems with the same connections and node capacities will
    // have the same solution, so this is the best data to construct a cacheKey with
    // For the cacheToSolveSpaceTransform, we just need to have something that allows us to convert from
    // a path in normalized (cache space) ids to the ids in this problem
    // this.cacheKey = cacheKey
    // this.cacheToSolveSpaceTransform = cacheToSolveSpaceTransform
    // return { cacheKey, cacheToSolveSpaceTransform }
  }

  applyCachedSolution(
    cachedSolution: CachedSolvedHyperCapacityPathingSection,
  ): void {
    if (!cachedSolution.success) {
      this.failed = true
      return
    }
    // TODO
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

    // TODO

    // const cachedSolution = ...
    // this.cacheProvider?.setCachedSolutionSync(this.cacheKey, cachedSolution)
  }
}
