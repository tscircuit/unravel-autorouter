import { Obstacle } from "lib/types"

export type BucketCoordinate = `${number}x${number}`

export class ObstacleSpatialHashIndex {
  buckets: Map<BucketCoordinate, [Obstacle, number][]>
  CELL_SIZE = 0.4

  constructor(public obstacles: Obstacle[]) {
    // console.log(
    //   `[ObstacleSHI] Initializing with ${obstacles.length} obstacles. CELL_SIZE: ${this.CELL_SIZE}`,
    // )
    this.buckets = new Map()
    let bucketEntriesCount = 0
    // for (const obstacle of obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i]
      const nodeMinX = obstacle.center.x - obstacle.width / 2
      const nodeMinY = obstacle.center.y - obstacle.height / 2
      const nodeMaxX = obstacle.center.x + obstacle.width / 2
      const nodeMaxY = obstacle.center.y + obstacle.height / 2
      for (let x = nodeMinX; x <= nodeMaxX; x += this.CELL_SIZE) {
        for (let y = nodeMinY; y <= nodeMaxY; y += this.CELL_SIZE) {
          const bucketKey = this.getBucketKey(x, y)
          const bucket = this.buckets.get(bucketKey)
          if (!bucket) {
            this.buckets.set(bucketKey, [[obstacle, i]])
          } else {
            bucket.push([obstacle, i])
            bucketEntriesCount++
          }
        }
      }
    }
    // console.log(
    //   `[ObstacleSHI] Initialization complete. Populated ${this.buckets.size} buckets with ${bucketEntriesCount} total entries.`,
    // )
  }

  getBucketKey(x: number, y: number): BucketCoordinate {
    return `${Math.floor(x / this.CELL_SIZE)}x${Math.floor(y / this.CELL_SIZE)}`
  }

  getNodesInArea(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): Obstacle[] {
    const obstacles: Obstacle[] = []
    const alreadyAddedObstacles = new Set<number>()
    const minX = centerX - width / 2
    const minY = centerY - height / 2
    const maxX = centerX + width / 2
    const maxY = centerY + height / 2
    for (let x = minX; x <= maxX; x += this.CELL_SIZE) {
      for (let y = minY; y <= maxY; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey) || []
        for (const obstacleWithIndex of bucket) {
          if (alreadyAddedObstacles.has(obstacleWithIndex[1])) continue
          alreadyAddedObstacles.add(obstacleWithIndex[1])
          obstacles.push(obstacleWithIndex[0])
        }
      }
    }
    return obstacles
  }
}

export const ObstacleTree = ObstacleSpatialHashIndex
