import { CachableSolver, CacheProvider } from "lib/cache/types"
import { UnravelSectionSolver } from "./UnravelSectionSolver"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import {
  PointModificationsMap,
  SegmentPointId,
  UnravelCandidate,
} from "./types"
import { createPointModificationsHash } from "./createPointModificationsHash"
import { BaseSolver } from "../BaseSolver"
import stableStringify from "fast-json-stable-stringify"
import objectHash from "object-hash"
import { getIssuesInSection } from "./getIssuesInSection"
import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { SegmentId } from "./types"
import { LocalStorageCache } from "lib/cache/LocalStorageCache"
import { setupGlobalCaches } from "lib/cache/setupGlobalCaches"

// Normalized IDs are simple strings like "node_0", "sp_1", etc.
type NormalizedId = string

interface CacheToUnravelSectionTransform {
  translationOffset: { x: number; y: number }
  // Mappings from original UUIDs to normalized IDs
  nodeIdMap: Map<CapacityMeshNodeId, NormalizedId>
  segmentIdMap: Map<SegmentId, NormalizedId>
  segmentPointIdMap: Map<SegmentPointId, NormalizedId>
  // Reverse mappings from normalized IDs back to original UUIDs
  reverseNodeIdMap: Map<NormalizedId, CapacityMeshNodeId>
  reverseSegmentIdMap: Map<NormalizedId, SegmentId>
  reverseSegmentPointIdMap: Map<NormalizedId, SegmentPointId>
}
interface CachedSolvedUnravelSection {
  // Store the essential result using NORMALIZED IDs and NORMALIZED coordinates
  bestCandidatePointModifications: Array<
    [NormalizedId, { x?: number; y?: number; z?: number }] // Normalized ID and coords
  >
  // Store the 'f' value to reconstruct the candidate accurately
  bestCandidateF: number
}

setupGlobalCaches()

export class CachedUnravelSectionSolver
  extends UnravelSectionSolver
  implements
    CachableSolver<CacheToUnravelSectionTransform, CachedSolvedUnravelSection>
{
  cacheHit = false
  cacheProvider: CacheProvider
  declare cacheToSolveSpaceTransform?:
    | CacheToUnravelSectionTransform
    | undefined
  hasAttemptedToUseCache = false

  constructor(
    params: ConstructorParameters<typeof UnravelSectionSolver>[0] & {
      cacheProvider?: CacheProvider
    },
  ) {
    super(params)
    // this.cacheProvider =
    //   params.cacheProvider ?? globalThis.TSCIRCUIT_AUTOROUTER_IN_MEMORY_CACHE
    this.cacheProvider =
      params.cacheProvider ??
      globalThis.TSCIRCUIT_AUTOROUTER_LOCAL_STORAGE_CACHE
  }

  _step() {
    if (!this.hasAttemptedToUseCache) {
      if (this.attemptToUseCacheSync()) return
    }
    console.log("calling super step")
    super._step()
    if (this.solved) {
      console.log("it got solved, saving to cache")
      console.log(this.cacheProvider)
      this.saveToCacheSync()
    }
  }

  computeCacheKeyAndTransform(): {
    cacheKey: string
    cacheToSolveSpaceTransform: CacheToUnravelSectionTransform
  } {
    // 1. Calculate Translation Offset
    const rootNode = this.nodeMap.get(this.rootNodeId)!
    const translationOffset = { x: -rootNode.center.x, y: -rootNode.center.y }

    // 2. Create ID Mappings
    const nodeIdMap = new Map<CapacityMeshNodeId, NormalizedId>()
    const reverseNodeIdMap = new Map<NormalizedId, CapacityMeshNodeId>()
    const segmentIdMap = new Map<SegmentId, NormalizedId>()
    const reverseSegmentIdMap = new Map<NormalizedId, SegmentId>()
    const segmentPointIdMap = new Map<SegmentPointId, NormalizedId>()
    const reverseSegmentPointIdMap = new Map<NormalizedId, SegmentPointId>()

    let nodeCounter = 0
    let segmentCounter = 0
    let spCounter = 0

    // Sort node IDs for deterministic normalized IDs based on coordinates (x then y)
    const sortedNodeIds = [...this.unravelSection.allNodeIds].sort(
      (aNId, bNId) => {
        const n1 = this.nodeMap.get(aNId)!
        const n2 = this.nodeMap.get(bNId)!

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

    // Sort segment point IDs for deterministic normalized IDs
    const sortedSegmentPointIds = [
      ...Array.from(this.unravelSection.segmentPointMap.entries())
        .sort(([, a], [, b]) => {
          if (a.x !== b.x) {
            return a.x - b.x
          }
          return a.y - b.y
        })
        .map(([id]) => id),
    ].sort()
    for (const spId of sortedSegmentPointIds) {
      const normSpId = `sp_${spCounter++}`
      segmentPointIdMap.set(spId, normSpId)
      reverseSegmentPointIdMap.set(normSpId, spId)

      const segmentId = this.unravelSection.segmentPointMap.get(spId)!.segmentId
      if (!segmentIdMap.has(segmentId)) {
        const normSegId = `seg_${segmentCounter++}`
        segmentIdMap.set(segmentId, normSegId)
        reverseSegmentIdMap.set(normSegId, segmentId)
      }
    }

    // 3. Create Normalized Structure for Hashing
    const normalizedNodes: Record<
      NormalizedId,
      {
        width: number
        height: number
        availableZ: number[]
        center: { x: number; y: number }
      }
    > = {}
    for (const [nodeId, normNodeId] of nodeIdMap.entries()) {
      const node = this.nodeMap.get(nodeId)!
      normalizedNodes[normNodeId] = {
        // ...node,
        width: node.width,
        height: node.height,
        availableZ: node.availableZ,
        center: {
          x: node.center.x + translationOffset.x,
          y: node.center.y + translationOffset.y,
        },
      }
    }

    const normalizedSegmentPoints: Record<
      NormalizedId,
      {
        x: number
        y: number
        z: number
        // segmentId: NormalizedId // Use normalized ID
        // connectionName: string
        // Add other relevant properties if needed
      }
    > = {}
    for (const [spId, normSpId] of segmentPointIdMap.entries()) {
      const sp = this.unravelSection.segmentPointMap.get(spId)!
      normalizedSegmentPoints[normSpId] = {
        x: sp.x + translationOffset.x,
        y: sp.y + translationOffset.y,
        z: sp.z,
        // segmentId: segmentIdMap.get(sp.segmentId)!,
        // connectionName: sp.connectionName,
      }
    }

    // Include connectivity/relationships if necessary for the hash
    // e.g., normalized segmentPairsInNode, normalized nodeIdToSegmentIds etc.
    // For simplicity, we'll hash nodes, points, and parameters for now.

    const keyData = {
      normalizedNodes,
      normalizedSegmentPoints,
      mutableHops: this.MUTABLE_HOPS,
    }

    // Use object-hash for potentially better handling of object structures
    // const cacheKey = stableStringify(keyData)
    const cacheKey = objectHash(keyData)

    const cacheToSolveSpaceTransform: CacheToUnravelSectionTransform = {
      translationOffset,
      nodeIdMap,
      segmentIdMap,
      segmentPointIdMap,
      reverseNodeIdMap,
      reverseSegmentIdMap,
      reverseSegmentPointIdMap,
    }

    this.cacheKey = cacheKey
    this.cacheToSolveSpaceTransform = cacheToSolveSpaceTransform

    return { cacheKey, cacheToSolveSpaceTransform }
  }

  applyCachedSolution(cachedSolution: CachedSolvedUnravelSection): void {
    if (!this.cacheToSolveSpaceTransform) {
      console.error("Cache transform not available to apply cached solution.")
      return
    }

    const {
      translationOffset,
      reverseSegmentPointIdMap,
      reverseNodeIdMap, // Needed if issues depend on node IDs
    } = this.cacheToSolveSpaceTransform

    // Create point modifications map using ORIGINAL IDs and ORIGINAL coordinates
    const pointModifications = new Map<
      SegmentPointId,
      { x?: number; y?: number; z?: number }
    >()

    for (const [
      normSpId,
      normMod,
    ] of cachedSolution.bestCandidatePointModifications) {
      const originalSpId = reverseSegmentPointIdMap.get(normSpId)
      if (!originalSpId) {
        console.warn(
          `Could not find original ID for normalized SP ID: ${normSpId}`,
        )
        continue
      }

      // Denormalize coordinates
      const originalMod: { x?: number; y?: number; z?: number } = {}
      if (normMod.x !== undefined)
        originalMod.x = normMod.x - translationOffset.x
      if (normMod.y !== undefined)
        originalMod.y = normMod.y - translationOffset.y
      if (normMod.z !== undefined) originalMod.z = normMod.z // Z is not translated

      pointModifications.set(originalSpId, originalMod)
    }

    // Reconstruct the best candidate using ORIGINAL IDs/coords
    // Note: Issues are recalculated based on the loaded (denormalized) modifications.
    //       'g' and 'h' might not be perfectly reconstructed if they depended
    //       on the path taken, but 'f' (the primary cost) is stored.
    const issues = getIssuesInSection(
      this.unravelSection,
      this.nodeMap,
      pointModifications,
    )

    this.bestCandidate = {
      pointModifications,
      issues,
      f: cachedSolution.bestCandidateF,
      g: cachedSolution.bestCandidateF, // Assume g is the main component off for cached solution
      h: 0, // Heuristic is 0 when solution is loaded
      operationsPerformed: -1, // Indicate it's from cache, operation count unknown
      candidateHash: createPointModificationsHash(pointModifications),
    }

    this.cacheHit = true
    this.solved = true // Mark as solved since we applied a cached solution
    console.log(`Cache hit for UnravelSectionSolver: ${this.cacheKey}`)
  }

  attemptToUseCacheSync(): boolean {
    this.hasAttemptedToUseCache = true
    if (!this.cacheProvider.isSyncCache) {
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
        this.applyCachedSolution(cachedSolution as CachedSolvedUnravelSection)
        return true
      } else {
        // console.log(`Cache miss for UnravelSectionSolver: ${this.cacheKey}`)
      }
    } catch (error) {
      console.error("Error attempting to use cache:", error)
    }

    return false
  }

  saveToCacheSync(): void {
    if (!this.bestCandidate) return
    const { translationOffset, segmentPointIdMap } =
      this.cacheToSolveSpaceTransform!

    // Convert best candidate modifications to NORMALIZED format
    const normalizedModifications: Array<
      [NormalizedId, { x?: number; y?: number; z?: number }]
    > = []

    for (const [
      originalSpId,
      originalMod,
    ] of this.bestCandidate.pointModifications.entries()) {
      const normSpId = segmentPointIdMap.get(originalSpId)
      if (!normSpId) {
        console.warn(
          `Could not find normalized ID for original SP ID: ${originalSpId} when saving to cache.`,
        )
        continue
      }

      // Normalize coordinates
      const normMod: { x?: number; y?: number; z?: number } = {}
      if (originalMod.x !== undefined)
        normMod.x = originalMod.x + translationOffset.x
      if (originalMod.y !== undefined)
        normMod.y = originalMod.y + translationOffset.y
      if (originalMod.z !== undefined) normMod.z = originalMod.z // Z is not translated

      normalizedModifications.push([normSpId, normMod])
    }

    const cachedSolution: CachedSolvedUnravelSection = {
      bestCandidatePointModifications: normalizedModifications,
      bestCandidateF: this.bestCandidate.f,
    }

    this.cacheProvider.setCachedSolutionSync(this.cacheKey!, cachedSolution)
  }
}
