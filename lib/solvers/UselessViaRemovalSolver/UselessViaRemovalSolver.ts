import { ObstacleTree } from "lib/data-structures/ObstacleTree"
import { SegmentTree } from "lib/data-structures/SegmentTree"
import { BaseSolver } from "../BaseSolver"
import { HighDensityRoute } from "lib/types/high-density-types"
import { Obstacle } from "lib/types"
import { GraphicsObject } from "graphics-debug"
import { mapZToLayerName } from "lib/utils/mapZToLayerName"

export interface UselessViaRemovalSolverInput {
  unsimplifiedHdRoutes: HighDensityRoute[]
  obstacles: Obstacle[]
  colorMap: Record<string, string>
  layerCount: number
}

export class UselessViaRemovalSolver extends BaseSolver {
  unsimplifiedHdRoutes: HighDensityRoute[] = []
  optimizedHdRoutes: HighDensityRoute[] = []
  removedViaCount = 0

  segmentTree: SegmentTree | null = null
  obstacleTree: ObstacleTree | null = null

  constructor(private input: UselessViaRemovalSolverInput) {
    super()
    this.unsimplifiedHdRoutes = input.unsimplifiedHdRoutes

    this.obstacleTree = new ObstacleTree(input.obstacles)
    this.segmentTree = new SegmentTree(
      this.unsimplifiedHdRoutes.flatMap(({ route }) => ({})),
    )
  }

  _step() {
    if (this.iterations === 1) {
      // Initialize obstacle tree
      this.obstacleTree = new ObstacleTree(this.input.obstacles)

      // Build segment tree from existing routes
      const segments: [Point, Point][] = []

      for (const route of this.unsimplifiedHdRoutes) {
        for (let i = 0; i < route.route.length - 1; i++) {
          const current = route.route[i]
          const next = route.route[i + 1]

          // Only add segments that are on the same layer
          if (current.z === next.z) {
            segments.push([
              { x: current.x, y: current.y, z: current.z },
              { x: next.x, y: next.y, z: next.z },
            ])
          }
        }
      }

      this.segmentTree = new SegmentTree(segments)

      // Process each route to remove unnecessary vias
      for (const hdRoute of this.unsimplifiedHdRoutes) {
        const optimizedRoute = this.optimizeVias(hdRoute)
        this.optimizedHdRoutes.push(optimizedRoute)
      }

      this.solved = true
    }
  }

  optimizeVias(hdRoute: HighDensityRoute): HighDensityRoute {
    const optimizedVias: { x: number; y: number }[] = []
    const routePoints = [...hdRoute.route]

    // Find all via points in the route
    for (let i = 0; i < hdRoute.vias.length; i++) {
      const via = hdRoute.vias[i]

      // Find the index of this via in the route
      const viaIndex = routePoints.findIndex(
        (point) =>
          Math.abs(point.x - via.x) < 0.001 &&
          Math.abs(point.y - via.y) < 0.001,
      )

      if (viaIndex <= 0 || viaIndex >= routePoints.length - 1) {
        // Keep vias at endpoints or if we can't find the via in the route
        optimizedVias.push(via)
        continue
      }

      // Get the point before and after the via
      const prevPoint = routePoints[viaIndex - 1]
      const viaPoint = routePoints[viaIndex]
      const nextPoint = routePoints[viaIndex + 1]

      // Check if we can replace the via with a straight segment
      if (this.canReplaceByStraightSegment(prevPoint, viaPoint, nextPoint)) {
        // Don't add the via to optimizedVias

        // Update the route to remove the layer change
        routePoints[viaIndex] = {
          ...viaPoint,
          z: prevPoint.z, // Keep on same layer as previous point
        }

        this.removedViaCount++
      } else {
        // Keep the via
        optimizedVias.push(via)
      }
    }

    // Return optimized route
    return {
      ...hdRoute,
      route: routePoints,
      vias: optimizedVias,
    }
  }

  canReplaceByStraightSegment(
    prevPoint: Point,
    viaPoint: Point,
    nextPoint: Point,
  ): boolean {
    // Skip if the previous and next points are on different layers
    if (prevPoint.z !== nextPoint.z) {
      return false
    }

    // Create a straight segment from prev to next at the same z level
    const segmentStart = { x: prevPoint.x, y: prevPoint.y, z: prevPoint.z }
    const segmentEnd = { x: nextPoint.x, y: nextPoint.y, z: nextPoint.z }

    // Check if the segment intersects with any obstacle
    const nearbyObstacles = this.obstacleTree!.getNodesInArea(
      (prevPoint.x + nextPoint.x) / 2,
      (prevPoint.y + nextPoint.y) / 2,
      Math.abs(prevPoint.x - nextPoint.x) + 1,
      Math.abs(prevPoint.y - nextPoint.y) + 1,
    )

    for (const obstacle of nearbyObstacles) {
      // Skip obstacles that don't block this layer
      if (!this.isLayerBlocked(prevPoint.z, obstacle)) {
        continue
      }

      // Check if segment intersects with obstacle
      if (this.segmentIntersectsObstacle(segmentStart, segmentEnd, obstacle)) {
        return false
      }
    }

    // Check if the segment would intersect with any other segment
    const potentiallyIntersectingSegments =
      this.segmentTree!.getSegmentsThatCouldIntersect(segmentStart, segmentEnd)

    for (const segment of potentiallyIntersectingSegments) {
      // Only check segments on the same layer
      if (
        segment[0].z === prevPoint.z &&
        this.segmentsIntersect(segmentStart, segmentEnd, segment[0], segment[1])
      ) {
        return false
      }
    }

    // If we got here, the via can be safely removed
    return true
  }

  isLayerBlocked(z: number, obstacle: Obstacle): boolean {
    // Check if the obstacle blocks the layer with index z
    if (obstacle.zLayers) {
      return obstacle.zLayers.includes(z)
    } else if (obstacle.layers) {
      const layerName = mapZToLayerName(z, this.input.layerCount)
      return obstacle.layers.includes(layerName)
    }
    return false
  }

  segmentIntersectsObstacle(p1: Point, p2: Point, obstacle: Obstacle): boolean {
    // Check if the segment formed by p1 and p2 intersects with the rectangle obstacle
    const rectLeft = obstacle.center.x - obstacle.width / 2
    const rectRight = obstacle.center.x + obstacle.width / 2
    const rectTop = obstacle.center.y - obstacle.height / 2
    const rectBottom = obstacle.center.y + obstacle.height / 2

    // Check if either endpoint is inside the obstacle
    if (
      this.isPointInRect(
        p1.x,
        p1.y,
        rectLeft,
        rectRight,
        rectTop,
        rectBottom,
      ) ||
      this.isPointInRect(p2.x, p2.y, rectLeft, rectRight, rectTop, rectBottom)
    ) {
      return true
    }

    // Check for line-rectangle intersection
    // Check each edge of the rectangle for intersection with the segment
    return (
      this.lineSegmentsIntersect(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        rectLeft,
        rectTop,
        rectRight,
        rectTop,
      ) || // Top edge
      this.lineSegmentsIntersect(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        rectRight,
        rectTop,
        rectRight,
        rectBottom,
      ) || // Right edge
      this.lineSegmentsIntersect(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        rectRight,
        rectBottom,
        rectLeft,
        rectBottom,
      ) || // Bottom edge
      this.lineSegmentsIntersect(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        rectLeft,
        rectBottom,
        rectLeft,
        rectTop,
      ) // Left edge
    )
  }

  isPointInRect(
    x: number,
    y: number,
    left: number,
    right: number,
    top: number,
    bottom: number,
  ): boolean {
    return x >= left && x <= right && y >= top && y <= bottom
  }

  lineSegmentsIntersect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
  ): boolean {
    // Calculate the direction of the segments
    const a1 = y2 - y1
    const b1 = x1 - x2
    const c1 = a1 * x1 + b1 * y1

    const a2 = y4 - y3
    const b2 = x3 - x4
    const c2 = a2 * x3 + b2 * y3

    const determinant = a1 * b2 - a2 * b1

    if (determinant === 0) {
      // Lines are parallel
      return false
    }

    const x = (b2 * c1 - b1 * c2) / determinant
    const y = (a1 * c2 - a2 * c1) / determinant

    // Check if the intersection point is within both line segments
    return (
      x >= Math.min(x1, x2) &&
      x <= Math.max(x1, x2) &&
      y >= Math.min(y1, y2) &&
      y <= Math.max(y1, y2) &&
      x >= Math.min(x3, x4) &&
      x <= Math.max(x3, x4) &&
      y >= Math.min(y3, y4) &&
      y <= Math.max(y3, y4)
    )
  }

  segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    return this.lineSegmentsIntersect(
      p1.x,
      p1.y,
      p2.x,
      p2.y,
      p3.x,
      p3.y,
      p4.x,
      p4.y,
    )
  }

  getOptimizedHdRoutes(): HighDensityRoute[] {
    return this.optimizedHdRoutes
  }

  visualize(): GraphicsObject {
    const visualization: Required<GraphicsObject> = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "Useless Via Removal Solver",
    }

    // Display each optimized route
    for (const route of this.optimizedHdRoutes) {
      // Skip routes with no points
      if (route.route.length === 0) continue

      const color = this.input.colorMap[route.connectionName] || "#888888"

      // Add lines connecting route points on the same layer
      for (let i = 0; i < route.route.length - 1; i++) {
        const current = route.route[i]
        const next = route.route[i + 1]

        // Only draw segments that are on the same layer
        if (current.z === next.z) {
          visualization.lines.push({
            points: [
              { x: current.x, y: current.y },
              { x: next.x, y: next.y },
            ],
            strokeColor: color,
            strokeWidth: route.traceThickness,
            label: `${route.connectionName} (z=${current.z})`,
          })
        }
      }

      // Add circles for vias
      for (const via of route.vias) {
        visualization.circles.push({
          center: { x: via.x, y: via.y },
          radius: route.viaDiameter / 2,
          fill: "rgba(255, 255, 255, 0.5)",
          label: `${route.connectionName} via`,
        })
      }
    }

    // Add text showing how many vias were removed
    if (this.solved) {
      visualization.points.push({
        x: 0,
        y: 0,
        label: `Removed ${this.removedViaCount} unnecessary vias`,
      })
    }

    return visualization
  }
}

// Type definition for points
interface Point {
  x: number
  y: number
  z: number
}
