import { CapacityMeshNode, CapacityMeshEdge } from "lib/types"

// Create test nodes with varying capacities and proper structure
export const sectionNodes: CapacityMeshNode[] = [
  {
    capacityMeshNodeId: "node1",
    center: { x: 10, y: 10 },
    width: 10, // Width derived from bounds (maxX - minX)
    height: 10, // Height derived from bounds (maxY - minY)
    availableZ: [0, 1], // Available Z levels (two layers)
    layer: "top",
    _containsTarget: true, // Adding target flag for node1
  },
  {
    capacityMeshNodeId: "node2",
    center: { x: 30, y: 10 },
    width: 10,
    height: 10,
    availableZ: [0, 1],
    layer: "top",
    _containsTarget: true, // Adding target flag for node2
  },
  {
    capacityMeshNodeId: "node3",
    center: { x: 10, y: 30 },
    width: 10,
    height: 10,
    availableZ: [0, 1],
    layer: "top",
    _containsTarget: true, // Adding target flag for node3
  },
  {
    capacityMeshNodeId: "node4",
    center: { x: 30, y: 30 },
    width: 10,
    height: 10,
    availableZ: [0, 1],
    layer: "top",
    _containsTarget: true, // Adding target flag for node4
  },
]

// Create edges between nodes
export const sectionEdges: CapacityMeshEdge[] = [
  {
    nodeIds: ["node1", "node2"],
    capacityMeshEdgeId: "edge1",
  },
  {
    nodeIds: ["node1", "node3"],
    capacityMeshEdgeId: "edge2",
  },
  {
    nodeIds: ["node2", "node4"],
    capacityMeshEdgeId: "edge3",
  },
  {
    nodeIds: ["node3", "node4"],
    capacityMeshEdgeId: "edge4",
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
