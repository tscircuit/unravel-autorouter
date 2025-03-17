interface Point {
  x: number
  y: number
  z: number
}

type Segment = [Point, Point]

type SegmentWithId = [Point, Point, string]

const getSegmentBounds = (segment: Segment) => {
  return {
    minX: Math.min(segment[0].x, segment[1].x),
    maxX: Math.max(segment[0].x, segment[1].x),
    minY: Math.min(segment[0].y, segment[1].y),
    maxY: Math.max(segment[0].y, segment[1].y),
  }
}
export type BucketCoordinate = `${number}x${number}`

export class SegmentTree {
  buckets: Map<BucketCoordinate, SegmentWithId[]>
  CELL_SIZE = 0.4

  constructor(public segments: Segment[]) {
    this.buckets = new Map()
    for (const segment of segments) {
      const bounds = getSegmentBounds(segment)
      const bucketMinX =
        Math.floor(bounds.minX / this.CELL_SIZE) * this.CELL_SIZE
      const bucketMinY =
        Math.floor(bounds.minY / this.CELL_SIZE) * this.CELL_SIZE

      for (let x = bucketMinX; x <= bounds.maxX; x += this.CELL_SIZE) {
        for (let y = bucketMinY; y <= bounds.maxY; y += this.CELL_SIZE) {
          const bucketKey = this.getBucketKey(x, y)
          const bucket = this.buckets.get(bucketKey)
          if (!bucket) {
            this.buckets.set(bucketKey, [
              [segment[0], segment[1], this.getSegmentKey(segment)],
            ])
          } else {
            bucket.push([segment[0], segment[1], this.getSegmentKey(segment)])
          }
        }
      }
    }
  }

  getBucketKey(x: number, y: number): BucketCoordinate {
    return `${Math.floor(x / this.CELL_SIZE)}x${Math.floor(y / this.CELL_SIZE)}`
  }

  getSegmentKey(segment: Segment): string {
    return `${segment[0].x}-${segment[0].y}-${segment[0].z}-${segment[1].x}-${segment[1].y}-${segment[1].z}`
  }

  getSegmentsThatCouldIntersect(A: Point, B: Point) {
    const segments: SegmentWithId[] = []
    const alreadyAddedSegments = new Set<string>()
    const minX = Math.min(A.x, B.x)
    const minY = Math.min(A.y, B.y)
    const maxX = Math.max(A.x, B.x)
    const maxY = Math.max(A.y, B.y)

    const bucketMinX = Math.floor(minX / this.CELL_SIZE) * this.CELL_SIZE
    const bucketMinY = Math.floor(minY / this.CELL_SIZE) * this.CELL_SIZE
    for (let x = bucketMinX; x <= maxX; x += this.CELL_SIZE) {
      for (let y = bucketMinY; y <= maxY; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey) || []
        for (const segment of bucket) {
          const key = segment[2]
          if (alreadyAddedSegments.has(key)) continue
          alreadyAddedSegments.add(key)
          segments.push(segment)
        }
      }
    }
    return segments
  }
}
