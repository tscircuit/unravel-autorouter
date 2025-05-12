import { describe, expect, it, beforeEach } from "bun:test"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CachedHyperCapacityPathingSingleSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CachedHyperCapacityPathingSingleSectionSolver"
import {
  sectionNodes,
  sectionConnectionTerminals,
  nodeMap,
  nodeEdgeMap,
} from "./problem1"

describe("CachedHyperCapacityPathingSingleSectionSolver Test 2", () => {
  let cache: InMemoryCache

  beforeEach(() => {
    cache = new InMemoryCache()
  })

  it("should handle failed solutions from cache", () => {
    // Create solver with cache
    const solver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Generate cache key
    const { cacheKey } = solver.computeCacheKeyAndTransform()

    // Create a mock failed solution
    const mockFailedSolution = {
      success: false,
    }

    // Save to cache manually
    cache.setCachedSolutionSync(cacheKey, mockFailedSolution)

    // Create a new solver that should use the cache
    const newSolver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Force cache attempt
    const cacheHit = newSolver.attemptToUseCacheSync()
    expect(cacheHit).toBe(true)
    expect(newSolver.cacheHit).toBe(true)
    expect(newSolver.failed).toBe(true)
    expect(newSolver.solved).toBe(false)
  })
})
