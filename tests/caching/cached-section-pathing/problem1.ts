import { CapacityMeshNode, CapacityMeshEdge } from "lib/types"

// Create test nodes with varying capacities
export const sectionNodes: CapacityMeshNode[] = [
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
export const sectionEdges: CapacityMeshEdge[] = [
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
export const sectionConnectionTerminals: Array<{
  connectionName: string
  startNodeId: string
  endNodeId: string
}> = [
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
export const nodeMap = new Map(
  sectionNodes.map((node) => [node.capacityMeshNodeId, node])
)

// Create node edge map
export const nodeEdgeMap = new Map<string, CapacityMeshEdge[]>()
for (const node of sectionNodes) {
  const edges = sectionEdges.filter((edge) =>
    edge.nodeIds.includes(node.capacityMeshNodeId)
  )
  nodeEdgeMap.set(node.capacityMeshNodeId, edges)
}
