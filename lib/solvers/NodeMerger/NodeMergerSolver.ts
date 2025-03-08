import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { BaseSolver } from "../BaseSolver"

export class NodeMergerSolver extends BaseSolver {
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  unprocessedNodeIds: CapacityMeshNodeId[]

  processedNodeIds: Set<CapacityMeshNodeId>

  newNodes: CapacityMeshNode[]
  constructor(nodes: CapacityMeshNode[]) {
    super()
    this.nodeMap = new Map()
    for (const node of nodes) {
      this.nodeMap.set(node.capacityMeshNodeId, node)
    }
    this.newNodes = []
    this.unprocessedNodeIds = Array.from(nodes.map((n) => n.capacityMeshNodeId))
    this.processedNodeIds = new Set()
  }

  _step() {
    const rootNodeId = this.unprocessedNodeIds.pop()

    if (!rootNodeId) {
      this.solved = true
      return
    }

    const node = this.nodeMap.get(rootNodeId)
    if (!node) {
      this.error = `Node ${rootNodeId} not found`
      this.failed = true
      return
    }
  }
}
