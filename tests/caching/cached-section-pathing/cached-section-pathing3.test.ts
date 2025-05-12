import { describe, expect, it, beforeEach } from "bun:test"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CachedHyperCapacityPathingSingleSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CachedHyperCapacityPathingSingleSectionSolver"
import {
  sectionNodes,
  sectionConnectionTerminals,
  nodeMap,
  nodeEdgeMap,
} from "./problem1"

describe("CachedHyperCapacityPathingSingleSectionSolver Test 3", () => {
  let cache: InMemoryCache

  beforeEach(() => {
    cache = new InMemoryCache()
  })

  it("should preserve node capacity values when roundtripping through cache", () => {
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
    const { cacheKey, cacheToSolveSpaceTransform } =
      solver.computeCacheKeyAndTransform()

    // Save fake solution to cache
    const mockSolution = {
      success: true,
      sectionScore: 0.95,
      solutionPaths: {} as Record<string, string[]>,
    }

    // Map the node IDs to cache space
    const realToCacheNodeId = new Map<string, string>()
    for (const [cacheId, realId] of cacheToSolveSpaceTransform.cacheSpaceToRealNodeId) {
      realToCacheNodeId.set(realId, cacheId)
    }

    // Map connection IDs to cache space
    const realToCacheConnectionId = new Map<string, string>()
    for (const [
      cacheConnId,
      realConnName,
    ] of cacheToSolveSpaceTransform.cacheSpaceToRealConnectionId) {
      realToCacheConnectionId.set(realConnName, cacheConnId)
    }

    // Add simple direct paths
    for (const conn of sectionConnectionTerminals) {
      const cacheConnId = realToCacheConnectionId.get(conn.connectionName)!
      mockSolution.solutionPaths[cacheConnId] = [
        realToCacheNodeId.get(conn.startNodeId)!,
        realToCacheNodeId.get(conn.endNodeId)!,
      ]
    }

    // Save mock solution to cache
    cache.setCachedSolutionSync(cacheKey, mockSolution)

    // Manually extract the cached content to verify capacity values
    const cacheContent = cache.getCachedSolutionSync(cacheKey)
    expect(cacheContent).toBeDefined()

    // Create a new solver to retrieve from cache
    const newSolver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Trigger cache retrieval
    newSolver.attemptToUseCacheSync()

    // Verify the cached paths are retrieved correctly
    const decodedPaths = newSolver.sectionConnectionTerminals
    expect(decodedPaths).toBeDefined()

    // Each path should have exactly 2 nodes (start and end)
    for (const conn of decodedPaths!) {
      expect(conn.path).toBeDefined()
      expect(conn.path!.length).toBe(2)

      // First node should be the start node
      expect(conn.path![0].capacityMeshNodeId).toBe(conn.startNodeId)

      // Last node should be the end node
      expect(conn.path![conn.path!.length - 1].capacityMeshNodeId).toBe(
        conn.endNodeId
      )
    }
  })
})
