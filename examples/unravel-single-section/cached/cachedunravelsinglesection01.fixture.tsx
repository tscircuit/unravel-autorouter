import React, { useState, useEffect, useMemo, useCallback } from "react"
import { CachableUnravelSectionSolver } from "lib/solvers/UnravelSolver/CachableUnravelSectionSolver"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger" // Import GenericSolverDebugger
import segmentpoint5 from "examples/assets/segmenttopoint5.json"
import { getDedupedSegments } from "lib/solvers/UnravelSolver/getDedupedSegments"
import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { SegmentId, SegmentPoint } from "lib/solvers/UnravelSolver/types"
import { SegmentWithAssignedPoints } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import { InMemoryCache } from "lib/cache/InMemoryCache"

// Function to prepare solver parameters from raw data
const prepareSolverParams = (
  rawData: typeof segmentpoint5,
  rootNodeId: CapacityMeshNodeId,
) => {
  const dedupedSegments = getDedupedSegments(rawData.assignedSegments)
  const nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode> = new Map()
  for (const node of rawData.nodes) {
    nodeMap.set(node.capacityMeshNodeId, node as CapacityMeshNode)
  }

  const nodeIdToSegmentIds = new Map<CapacityMeshNodeId, SegmentId[]>()
  const segmentIdToNodeIds = new Map<SegmentId, CapacityMeshNodeId[]>()

  for (const segment of rawData.assignedSegments) {
    if (!segment.nodePortSegmentId) continue // Skip if no ID
    segmentIdToNodeIds.set(segment.nodePortSegmentId, [
      ...(segmentIdToNodeIds.get(segment.nodePortSegmentId) ?? []),
      segment.capacityMeshNodeId,
    ])
    nodeIdToSegmentIds.set(segment.capacityMeshNodeId, [
      ...(nodeIdToSegmentIds.get(segment.capacityMeshNodeId) ?? []),
      segment.nodePortSegmentId,
    ])
  }

  return {
    dedupedSegments,
    nodeMap,
    rootNodeId,
    nodeIdToSegmentIds,
    segmentIdToNodeIds,
    colorMap: rawData.colorMap,
  }
}

// Function to create a translated and ID-remapped version of the data
const createModifiedData = (
  originalData: typeof segmentpoint5,
  originalRootNodeId: CapacityMeshNodeId,
  translation: { x: number; y: number },
): { modifiedData: typeof segmentpoint5; newRootNodeId: CapacityMeshNodeId } => {
  const modifiedData = structuredClone(originalData)
  const nodeUuidMap = new Map<CapacityMeshNodeId, CapacityMeshNodeId>()
  const segmentUuidMap = new Map<SegmentId, SegmentId>()
  let newRootNodeId: CapacityMeshNodeId = ""

  // Remap and translate nodes
  modifiedData.nodes = modifiedData.nodes.map((node) => {
    const newNodeId = `mod-${crypto.randomUUID().substring(0, 6)}` // Generate new node ID
    nodeUuidMap.set(node.capacityMeshNodeId, newNodeId)
    if (node.capacityMeshNodeId === originalRootNodeId) {
      newRootNodeId = newNodeId
    }
    return {
      ...node,
      capacityMeshNodeId: newNodeId,
      center: {
        x: node.center.x + translation.x,
        y: node.center.y + translation.y,
      },
      // Also update parent references if they exist and are part of the map
      _parent: node._parent
        ? {
            capacityMeshNodeId:
              nodeUuidMap.get(node._parent.capacityMeshNodeId) ??
              node._parent.capacityMeshNodeId, // Fallback if parent not mapped yet (shouldn't happen with structuredClone?)
          }
        : undefined,
    }
  })

  // Remap and translate segments and their points
  modifiedData.assignedSegments = modifiedData.assignedSegments.map(
    (segment) => {
      const originalSegmentId = segment.nodePortSegmentId!
      let newSegmentId = segmentUuidMap.get(originalSegmentId)
      if (!newSegmentId) {
        newSegmentId = `mod-seg-${crypto.randomUUID().substring(0, 6)}` // Generate new segment ID
        segmentUuidMap.set(originalSegmentId, newSegmentId)
      }

      return {
        ...segment,
        capacityMeshNodeId: nodeUuidMap.get(segment.capacityMeshNodeId)!, // Use new node ID
        nodePortSegmentId: newSegmentId, // Use new segment ID
        start: {
          x: segment.start.x + translation.x,
          y: segment.start.y + translation.y,
        },
        end: {
          x: segment.end.x + translation.x,
          y: segment.end.y + translation.y,
        },
        assignedPoints: segment.assignedPoints.map((ap) => ({
          ...ap,
          point: {
            x: ap.point.x + translation.x,
            y: ap.point.y + translation.y,
            z: ap.point.z,
          },
        })),
      }
    },
  )

  if (!newRootNodeId) {
    throw new Error("Original root node ID not found during modification")
  }

  return { modifiedData, newRootNodeId }
}

export default function CachedUnravel1() {
  // State to hold the results of the initial automatic run
  const [solver1Result, setSolver1Result] =
    useState<CachableUnravelSectionSolver | null>(null)
  const [solver2Result, setSolver2Result] =
    useState<CachableUnravelSectionSolver | null>(null)
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 })

  const cacheProvider = globalThis.TSCIRCUIT_AUTOROUTER_IN_MEMORY_CACHE

  // Prepare original and modified data once
  const { originalParams, modifiedParams } = useMemo(() => {
    const originalRootId = "cn58" // Choose a root node from the data
    const translation = { x: 100, y: 50 }

    const originalParams = prepareSolverParams(segmentpoint5, originalRootId)
    const { modifiedData, newRootNodeId } = createModifiedData(
      segmentpoint5,
      originalRootId,
      translation,
    )
    const modifiedParams = prepareSolverParams(modifiedData, newRootNodeId)

    return { originalParams, modifiedParams }
  }, [])

  useEffect(() => {
    // Clear cache before running the example for consistent results
    cacheProvider.clearCache()
    setCacheStats({ hits: cacheProvider.cacheHits, misses: cacheProvider.cacheMisses })


    // Create and run solver 1 (original data)
    const s1 = new CachableUnravelSectionSolver({
      ...originalParams,
      cacheProvider,
    })
    s1.solve() // Run to populate cache
    setSolver1Result(s1) // Store the result of the first run
    setCacheStats({ hits: cacheProvider.cacheHits, misses: cacheProvider.cacheMisses })


    // Create and run solver 2 (modified data) - should hit cache
    const s2 = new CachableUnravelSectionSolver({
      ...modifiedParams,
      cacheProvider,
    })
    s2.solve() // Should be a cache hit
    setSolver2Result(s2) // Store the result of the second run

    // Update stats after both solvers have run
    // Update stats one last time after both solvers have run and state is set
    setCacheStats({ hits: cacheProvider.cacheHits, misses: cacheProvider.cacheMisses })

  }, [originalParams, modifiedParams, cacheProvider]) // Rerun if data prep changes

  // Define createSolver functions for GenericSolverDebugger
  const createSolver1 = useCallback(() => {
    // This creates a NEW solver instance for the debugger
    return new CachableUnravelSectionSolver({
      ...originalParams,
      cacheProvider,
    })
  }, [originalParams, cacheProvider])

  const createSolver2 = useCallback(() => {
    // This creates a NEW solver instance for the debugger
    return new CachableUnravelSectionSolver({
      ...modifiedParams,
      cacheProvider,
    })
  }, [modifiedParams, cacheProvider])


  return (
    <div className="flex flex-col space-y-4 p-4">
      <h1 className="text-xl font-bold">Cached Unravel Section Solver Example (Using GenericSolverDebugger)</h1>
      <div className="border p-2 rounded">
        <h2 className="text-lg font-semibold">Cache Stats</h2>
        <p>Hits: {cacheStats.hits}</p>
        <p>Misses: {cacheStats.misses}</p>
        <p>Expected: 1 Miss (Solver 1), 1 Hit (Solver 2)</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Solver 1 (Original Data)</h2>
          <p>Initial Run Cache Hit: {solver1Result?.cacheHit ? "Yes" : solver1Result === null ? "Running..." : "No"}</p>
          <GenericSolverDebugger createSolver={createSolver1} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            Solver 2 (Translated & ID-Remapped Data)
          </h2>
          <p>Initial Run Cache Hit: {solver2Result?.cacheHit ? "Yes" : solver2Result === null ? "Running..." : "No"}</p>
          <GenericSolverDebugger createSolver={createSolver2} />
        </div>
      </div>
    </div>
  )
}
