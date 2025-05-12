import { CapacityMeshNode, CapacityMeshEdge } from "lib/types"

// Node Definitions (12 nodes, specific layout based on 5x4 grid + additions)
// Row 1: 0 0 A F
const nodeA = {
  capacityMeshNodeId: "nodeA",
  center: { x: 5, y: 1 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeF = {
  capacityMeshNodeId: "nodeF",
  center: { x: 7, y: 1 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
// Row 2: C 1 1 1
const nodeC = {
  capacityMeshNodeId: "nodeC",
  center: { x: 1, y: 3 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR2C2 = {
  capacityMeshNodeId: "nodeR2C2",
  center: { x: 3, y: 3 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR2C3 = {
  capacityMeshNodeId: "nodeR2C3",
  center: { x: 5, y: 3 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR2C4 = {
  capacityMeshNodeId: "nodeR2C4",
  center: { x: 7, y: 3 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
// Row 3: 0 0 1 1
const nodeR3C3 = {
  capacityMeshNodeId: "nodeR3C3",
  center: { x: 5, y: 5 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR3C4 = {
  capacityMeshNodeId: "nodeR3C4",
  center: { x: 7, y: 5 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
// Row 4: B 1 1 0
const nodeB = {
  capacityMeshNodeId: "nodeB",
  center: { x: 1, y: 7 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR4C2 = {
  capacityMeshNodeId: "nodeR4C2",
  center: { x: 3, y: 7 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeR4C3 = {
  capacityMeshNodeId: "nodeR4C3",
  center: { x: 5, y: 7 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
// Row 5: 0 0 D E
const nodeD = {
  capacityMeshNodeId: "nodeD",
  center: { x: 5, y: 9 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}
const nodeE = {
  capacityMeshNodeId: "nodeE",
  center: { x: 7, y: 9 },
  width: 1,
  height: 1,
  availableZ: [0, 1],
  layer: "top",
  _containsTarget: true,
}

export const sectionNodes: CapacityMeshNode[] = [
  nodeA,
  nodeF,
  nodeC,
  nodeR2C2,
  nodeR2C3,
  nodeR2C4,
  nodeR3C3,
  nodeR3C4,
  nodeB,
  nodeR4C2,
  nodeR4C3,
  nodeD,
  nodeE,
]

// Edge Definitions (connecting adjacent nodes)
export const sectionEdges: CapacityMeshEdge[] = [
  { nodeIds: ["nodeA", "nodeF"], capacityMeshEdgeId: "edgeA_F" },
  { nodeIds: ["nodeF", "nodeR2C4"], capacityMeshEdgeId: "edgeF_R2C4" },
  { nodeIds: ["nodeA", "nodeR2C3"], capacityMeshEdgeId: "edgeA_R2C3" },
  { nodeIds: ["nodeC", "nodeR2C2"], capacityMeshEdgeId: "edgeC_R2C2" },
  { nodeIds: ["nodeR2C2", "nodeR2C3"], capacityMeshEdgeId: "edgeR2C2_R2C3" },
  { nodeIds: ["nodeR2C3", "nodeR2C4"], capacityMeshEdgeId: "edgeR2C3_R2C4" },
  { nodeIds: ["nodeR2C3", "nodeR3C3"], capacityMeshEdgeId: "edgeR2C3_R3C3" },
  { nodeIds: ["nodeR2C4", "nodeR3C4"], capacityMeshEdgeId: "edgeR2C4_R3C4" },
  { nodeIds: ["nodeR3C3", "nodeR3C4"], capacityMeshEdgeId: "edgeR3C3_R3C4" },
  { nodeIds: ["nodeR3C3", "nodeR4C3"], capacityMeshEdgeId: "edgeR3C3_R4C3" },
  { nodeIds: ["nodeB", "nodeR4C2"], capacityMeshEdgeId: "edgeB_R4C2" },
  { nodeIds: ["nodeR4C2", "nodeR4C3"], capacityMeshEdgeId: "edgeR4C2_R4C3" },
  { nodeIds: ["nodeR4C3", "nodeD"], capacityMeshEdgeId: "edgeR4C3_D" },
  { nodeIds: ["nodeD", "nodeE"], capacityMeshEdgeId: "edgeD_E" },
]

// Connection Terminals
export const sectionConnectionTerminals: Array<{
  connectionName: string
  startNodeId: string
  endNodeId: string
}> = [
  {
    connectionName: "connection_A_B",
    startNodeId: "nodeA",
    endNodeId: "nodeB",
  },
  {
    connectionName: "connection_C_D",
    startNodeId: "nodeC",
    endNodeId: "nodeD",
  },
]

// Create node map
export const nodeMap = new Map(
  sectionNodes.map((node) => [node.capacityMeshNodeId, node]),
)

// Create node edge map
export const nodeEdgeMap = new Map<string, CapacityMeshEdge[]>()
for (const node of sectionNodes) {
  const edges = sectionEdges.filter((edge) =>
    edge.nodeIds.includes(node.capacityMeshNodeId),
  )
  nodeEdgeMap.set(node.capacityMeshNodeId, edges)
}
