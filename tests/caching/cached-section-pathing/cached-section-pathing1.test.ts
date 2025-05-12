import { describe, expect, it, beforeEach } from "bun:test"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CachedHyperCapacityPathingSingleSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CachedHyperCapacityPathingSingleSectionSolver"
import {
  sectionNodes,
  sectionConnectionTerminals,
  nodeMap,
  nodeEdgeMap,
} from "./problem1"

describe("CachedHyperCapacityPathingSingleSectionSolver Test 1", () => {
  let cache: InMemoryCache

  beforeEach(() => {
    cache = new InMemoryCache()
  })

  it("should correctly encode to cache space and decode back to original space", () => {
    // Create solver with cache
    const solver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Generate cache key and transform
    const { cacheKey, cacheToSolveSpaceTransform } = solver.computeCacheKeyAndTransform()

    // Verify we got a cache key
    expect(cacheKey).toBeDefined()
    expect(cacheKey.startsWith("capacitypathing:")).toBe(true)

    // Create a mock solution in cache space to save
    const mockCacheSolution = {
      success: true,
      sectionScore: 0.85,
      solutionPaths: {} as Record<string, string[]>,
    }

    // Get the reverse mappings to create test paths
    const realToCacheNodeId = new Map<string, string>()
    for (const [cacheId, realId] of cacheToSolveSpaceTransform.cacheSpaceToRealNodeId) {
      realToCacheNodeId.set(realId, cacheId)
    }

    const realToCacheConnectionId = new Map<string, string>()
    for (const [cacheConnId, realConnName] of cacheToSolveSpaceTransform.cacheSpaceToRealConnectionId) {
      realToCacheConnectionId.set(realConnName, cacheConnId)
    }

    // Create solution paths in cache space format
    for (const conn of sectionConnectionTerminals) {
      const cacheConnId = realToCacheConnectionId.get(conn.connectionName)!
      // For connection1, create a path: node1 -> node2 -> node4
      if (conn.connectionName === "connection1") {
        mockCacheSolution.solutionPaths[cacheConnId] = [
          realToCacheNodeId.get("node1")!,
          realToCacheNodeId.get("node2")!,
          realToCacheNodeId.get("node4")!,
        ]
      }
      // For connection2, create a path: node2 -> node1 -> node3
      else if (conn.connectionName === "connection2") {
        mockCacheSolution.solutionPaths[cacheConnId] = [
          realToCacheNodeId.get("node2")!,
          realToCacheNodeId.get("node1")!,
          realToCacheNodeId.get("node3")!,
        ]
      }
    }

    // Save to cache manually
    cache.setCachedSolutionSync(cacheKey, mockCacheSolution)

    // Create a new solver that should use the cache
    const newSolver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Force cache attempt (normally done in _step())
    const cacheHit = newSolver.attemptToUseCacheSync()
    expect(cacheHit).toBe(true)
    expect(newSolver.cacheHit).toBe(true)
    expect(newSolver.solved).toBe(true)

    // Get the paths after decoding
    const decodedPaths = newSolver.sectionConnectionTerminals

    // Verify path for connection1: node1 -> node2 -> node4
    const path1 = decodedPaths?.find(conn => conn.connectionName === "connection1")?.path
    expect(path1).toBeDefined()
    expect(path1?.length).toBe(3)
    expect(path1?.[0].capacityMeshNodeId).toBe("node1")
    expect(path1?.[1].capacityMeshNodeId).toBe("node2")
    expect(path1?.[2].capacityMeshNodeId).toBe("node4")

    // Verify path for connection2: node2 -> node1 -> node3
    const path2 = decodedPaths?.find(conn => conn.connectionName === "connection2")?.path
    expect(path2).toBeDefined()
    expect(path2?.length).toBe(3)
    expect(path2?.[0].capacityMeshNodeId).toBe("node2")
    expect(path2?.[1].capacityMeshNodeId).toBe("node1")
    expect(path2?.[2].capacityMeshNodeId).toBe("node3")
  })
})
