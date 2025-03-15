import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"

export type BucketCoordinate = `${number}x${number}`

export class CapacityNodeTree {
  buckets: Map<BucketCoordinate, CapacityMeshNode[]>
  CELL_SIZE = 1

  constructor(public nodes: CapacityMeshNode[]) {
    this.buckets = new Map()
    for (const node of nodes) {
      const nodeMinX = node.center.x - node.width / 2
      const nodeMinY = node.center.y - node.height / 2
      const nodeMaxX = node.center.x + node.width / 2
      const nodeMaxY = node.center.y + node.height / 2
      for (let x = nodeMinX; x <= nodeMaxX; x += this.CELL_SIZE) {
        for (let y = nodeMinY; y <= nodeMaxY; y += this.CELL_SIZE) {
          const bucketKey = this.getBucketKey(x, y)
          const bucket = this.buckets.get(bucketKey)
          if (!bucket) {
            this.buckets.set(bucketKey, [node])
          } else {
            bucket.push(node)
          }
        }
      }
    }
  }

  getBucketKey(x: number, y: number): BucketCoordinate {
    return `${Math.floor(x / this.CELL_SIZE)}x${Math.floor(y / this.CELL_SIZE)}`
  }

  getNodesInArea(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ) {
    const nodes: CapacityMeshNode[] = []
    const alreadyAddedNodes = new Set<CapacityMeshNodeId>()
    const minX = centerX - width / 2
    const minY = centerY - height / 2
    const maxX = centerX + width / 2
    const maxY = centerY + height / 2
    for (let x = minX; x <= maxX; x += this.CELL_SIZE) {
      for (let y = minY; y <= maxY; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey) || []
        for (const node of bucket) {
          if (alreadyAddedNodes.has(node.capacityMeshNodeId)) continue
          alreadyAddedNodes.add(node.capacityMeshNodeId)
          nodes.push(node)
        }
      }
    }
    return nodes
  }
}
