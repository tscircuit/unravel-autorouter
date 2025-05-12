import { describe, expect, it, beforeEach } from "bun:test"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CachedHyperCapacityPathingSingleSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CachedHyperCapacityPathingSingleSectionSolver"
import {
  sectionNodes,
  sectionConnectionTerminals,
  nodeMap,
  nodeEdgeMap,
  sectionEdges,
} from "./problem1"
import { getSvgFromGraphicsObject } from "graphics-debug"

describe("CachedHyperCapacityPathingSingleSectionSolver Test 1", () => {
  const cache = new InMemoryCache()

  it("should correctly encode to cache space and decode back to original space", async () => {
    // Create solver with cache
    const solver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionEdges,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      colorMap: {
        connection1: "red",
        connection2: "blue",
      },
      cacheProvider: cache,
    })

    // Generate cache key and transform
    const { cacheKey, cacheToSolveSpaceTransform } =
      solver.computeCacheKeyAndTransform()

    solver.initializeSolvers()
    // const svg = getSvgFromGraphicsObject(await solver.visualize(), {
    //   includeTextLabels: true,
    // })
    // expect(svg).toMatchSvgSnapshot(import.meta.path)
    // Actually solve the problem, this should save to cache
    await solver.solve()

    const svg = getSvgFromGraphicsObject(await solver.visualize(), {
      includeTextLabels: true,
    })
    expect(svg).toMatchSvgSnapshot(import.meta.path)

    // Create a new solver that should use the cache
    const newSolver = new CachedHyperCapacityPathingSingleSectionSolver({
      sectionNodes,
      sectionEdges,
      sectionConnectionTerminals,
      centerNodeId: "node1",
      nodeMap,
      nodeEdgeMap,
      cacheProvider: cache,
    })

    // Force cache attempt (normally done in _step())
    const cacheHit = newSolver.attemptToUseCacheSync()
    expect(cacheHit).toBe(true)
  })
})
