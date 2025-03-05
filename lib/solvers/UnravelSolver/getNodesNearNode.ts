import { CapacityMeshNodeId } from "lib/types"

export function getNodesNearNode(params: {
  nodeId: CapacityMeshNodeId
  nodeIdToSegmentIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  segmentIdToNodeIds: Map<CapacityMeshNodeId, CapacityMeshNodeId[]>
  hops: number
}): CapacityMeshNodeId[] {
  const { nodeId, nodeIdToSegmentIds, segmentIdToNodeIds, hops } = params

  if (hops === 0) return [nodeId]
  const segments = nodeIdToSegmentIds.get(nodeId)!
  const nodes = new Set<CapacityMeshNodeId>()
  for (const segmentId of segments) {
    const adjacentNodeIds = segmentIdToNodeIds.get(segmentId)!
    for (const adjacentNodeId of adjacentNodeIds) {
      const ancestors = getNodesNearNode({
        nodeId: adjacentNodeId,
        nodeIdToSegmentIds,
        segmentIdToNodeIds,
        hops: hops - 1,
      })
      for (const ancestor of ancestors) {
        nodes.add(ancestor)
      }
    }
  }
  return Array.from(nodes)
}
