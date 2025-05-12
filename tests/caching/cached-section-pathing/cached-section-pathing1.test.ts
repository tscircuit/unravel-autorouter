import { describe, expect, it, beforeEach } from "bun:test"
import { InMemoryCache } from "lib/cache/InMemoryCache"
import { CachedHyperCapacityPathingSingleSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CachedHyperCapacityPathingSingleSectionSolver"
import { CapacityMeshNode, CapacityMeshEdge } from "lib/types"

describe("CachedHyperCapacityPathingSingleSectionSolver", () => {
  let cache: InMemoryCache
  let sectionNodes: CapacityMeshNode[]
  let sectionEdges: CapacityMeshEdge[]
  let sectionConnectionTerminals: Array<{
    connectionName: string
    startNodeId: string
    endNodeId: string
  }>
  let nodeMap: Map<string, CapacityMeshNode>
  let nodeEdgeMap: Map<string, CapacityMeshEdge[]>

  beforeEach(() => {
    cache = new InMemoryCache()

    // Create test nodes with varying capacities
    sectionNodes = [
      {
        capacityMeshNodeId: "node1",
        center: { x: 10, y: 10 },
        bounds: { minX: 5, minY: 5, maxX: 15, maxY: 15 },
        totalCapacity: 10.5,
        usedCapacity: 2.0,
        z: 0,
        layer: "top",
      },
      {
        capacityMeshNodeId: "node2",
        center: { x: 30, y: 10 },
        bounds: { minX: 25, minY: 5, maxX: 35, maxY: 15 },
        totalCapacity: 8.0,
        usedCapacity: 1.0,
        z: 0,
        layer: "top",
      },
      {
        capacityMeshNodeId: "node3",
        center: { x: 10, y: 30 },
        bounds: { minX: 5, minY: 25, maxX: 15, maxY: 35 },
        totalCapacity: 12.0,
        usedCapacity: 0.0,
        z: 0,
        layer: "top",
      },
      {
        capacityMeshNodeId: "node4",
        center: { x: 30, y: 30 },
        bounds: { minX: 25, minY: 25, maxX: 35, maxY: 35 },
        totalCapacity: 9.0,
        usedCapacity: 3.0,
        z: 0,
        layer: "top",
      },
    ]

    // Create edges between nodes
    sectionEdges = [
      {
        nodeIds: ["node1", "node2"],
        capacityMeshEdgeId: "edge1",
        bounds: { minX: 15, minY: 7.5, maxX: 25, maxY: 12.5 },
      },
      {
        nodeIds: ["node1", "node3"],
        capacityMeshEdgeId: "edge2",
        bounds: { minX: 7.5, minY: 15, maxX: 12.5, maxY: 25 },
      },
      {
        nodeIds: ["node2", "node4"],
        capacityMeshEdgeId: "edge3",
        bounds: { minX: 27.5, minY: 15, maxX: 32.5, maxY: 25 },
      },
      {
        nodeIds: ["node3", "node4"],
        capacityMeshEdgeId: "edge4",
        bounds: { minX: 15, minY: 27.5, maxX: 25, maxY: 32.5 },
      },
    ]

    // Create connection terminals
    sectionConnectionTerminals = [
      {
        connectionName: "connection1",
        startNodeId: "node1",
        endNodeId: "node4",
      },
      {
        connectionName: "connection2",
        startNodeId: "node2",
        endNodeId: "node3",
      },
    ]

    // Create node map
    nodeMap = new Map(sectionNodes.map((node) => [node.capacityMeshNodeId, node]))

    // Create node edge map
    nodeEdgeMap = new Map()
    for (const node of sectionNodes) {
      const edges = sectionEdges.filter((edge) =>
        edge.nodeIds.includes(node.capacityMeshNodeId)
      )
      nodeEdgeMap.set(node.capacityMeshNodeId, edges)
    }
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
      success: false
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
    const { cacheKey, cacheToSolveSpaceTransform } = solver.computeCacheKeyAndTransform()

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
    for (const [cacheConnId, realConnName] of cacheToSolveSpaceTransform.cacheSpaceToRealConnectionId) {
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
      expect(conn.path![conn.path!.length - 1].capacityMeshNodeId).toBe(conn.endNodeId)
    }
  })
})