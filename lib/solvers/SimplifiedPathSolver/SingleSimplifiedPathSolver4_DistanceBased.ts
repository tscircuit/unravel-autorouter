import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { Obstacle } from "lib/types"
import { GraphicsObject } from "graphics-debug"
import { SingleSimplifiedPathSolver } from "./SingleSimplifiedPathSolver"
import { calculate45DegreePaths } from "lib/utils/calculate45DegreePaths"

interface Point {
  x: number
  y: number
  z: number
}

interface PathSegment {
  start: Point
  end: Point
  length: number
  startDistance: number
  endDistance: number
}

export class SingleSimplifiedPathSolver4 extends SingleSimplifiedPathSolver {
  private pathSegments: PathSegment[] = []
  private totalPathLength: number = 0
  private headDistanceAlongPath: number = 0
  private tailDistanceAlongPath: number = 0
  private stepSize: number = 0.5 // Default step size, can be adjusted

  constructor(
    public inputRoute: HighDensityIntraNodeRoute,
    public otherHdRoutes: HighDensityIntraNodeRoute[],
    public obstacles: Obstacle[],
  ) {
    super(inputRoute, otherHdRoutes, obstacles)

    // Handle empty or single-point routes
    if (this.inputRoute.route.length <= 1) {
      this.newRoute = [...this.inputRoute.route]
      this.solved = true
      return
    }

    // Compute path segments and total length
    this.computePathSegments()
  }

  // Compute the path segments and their distances
  private computePathSegments() {
    let cumulativeDistance = 0

    for (let i = 0; i < this.inputRoute.route.length - 1; i++) {
      const start = this.inputRoute.route[i]
      const end = this.inputRoute.route[i + 1]

      // Calculate segment length using Euclidean distance
      const length = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2),
      )

      this.pathSegments.push({
        start,
        end,
        length,
        startDistance: cumulativeDistance,
        endDistance: cumulativeDistance + length,
      })

      cumulativeDistance += length
    }

    this.totalPathLength = cumulativeDistance
  }

  // Helper to check if two points are the same
  private arePointsEqual(p1: Point, p2: Point): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z
  }

  // Get point at a specific distance along the path
  private getPointAtDistance(distance: number): Point {
    // Ensure distance is within bounds
    distance = Math.max(0, Math.min(distance, this.totalPathLength))

    // Find the segment that contains this distance
    const segment = this.pathSegments.find(
      (seg) => distance >= seg.startDistance && distance <= seg.endDistance,
    )

    if (!segment) {
      // Fallback to last point if segment not found
      return this.inputRoute.route[this.inputRoute.route.length - 1]
    }

    // Calculate interpolation factor (between 0 and 1)
    const factor = (distance - segment.startDistance) / segment.length

    // Interpolate the point
    return {
      x: segment.start.x + factor * (segment.end.x - segment.start.x),
      y: segment.start.y + factor * (segment.end.y - segment.start.y),
      z: segment.start.z, // Z doesn't interpolate - use the segment's start z value
    }
  }

  // Find nearest index in the original route for a given distance
  private getNearestIndexForDistance(distance: number): number {
    if (distance <= 0) return 0
    if (distance >= this.totalPathLength)
      return this.inputRoute.route.length - 1

    // Find the segment that contains this distance
    const segmentIndex = this.pathSegments.findIndex(
      (seg) => distance >= seg.startDistance && distance <= seg.endDistance,
    )

    if (segmentIndex === -1) return 0

    // If closer to the end of the segment, return the next index
    const segment = this.pathSegments[segmentIndex]
    const midDistance = (segment.startDistance + segment.endDistance) / 2

    return distance > midDistance ? segmentIndex + 1 : segmentIndex
  }

  // Get the simplified route result
  get simplifiedRoute(): HighDensityIntraNodeRoute {
    return {
      connectionName: this.inputRoute.connectionName,
      traceThickness: this.inputRoute.traceThickness,
      viaDiameter: this.inputRoute.viaDiameter,
      route: this.newRoute,
      vias: this.newVias,
    }
  }

  isValidPath(pointsInRoute: Point[]): boolean {
    if (pointsInRoute.length < 2) return true

    // Check for layer changes - we don't allow simplifying across layer changes
    for (let i = 0; i < pointsInRoute.length - 1; i++) {
      if (pointsInRoute[i].z !== pointsInRoute[i + 1].z) {
        return false
      }
    }

    // Get the start and end points of our simplified segment
    const start = pointsInRoute[0]
    const end = pointsInRoute[pointsInRoute.length - 1]

    // Check if the segment intersects with any obstacle
    for (const obstacle of this.obstacles) {
      // Simple bounding box check first
      const obstacleLeft = obstacle.center.x - obstacle.width / 2
      const obstacleRight = obstacle.center.x + obstacle.width / 2
      const obstacleTop = obstacle.center.y - obstacle.height / 2
      const obstacleBottom = obstacle.center.y + obstacle.height / 2

      // Check if the line might intersect with this obstacle's borders
      if (
        doSegmentsIntersect(
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
          { x: obstacleLeft, y: obstacleTop },
          { x: obstacleRight, y: obstacleTop },
        ) ||
        doSegmentsIntersect(
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
          { x: obstacleRight, y: obstacleTop },
          { x: obstacleRight, y: obstacleBottom },
        ) ||
        doSegmentsIntersect(
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
          { x: obstacleRight, y: obstacleBottom },
          { x: obstacleLeft, y: obstacleBottom },
        ) ||
        doSegmentsIntersect(
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
          { x: obstacleLeft, y: obstacleBottom },
          { x: obstacleLeft, y: obstacleTop },
        )
      ) {
        return false
      }
    }

    // Check if the segment intersects with any other route
    for (const route of this.otherHdRoutes) {
      for (let i = 0; i < route.route.length - 1; i++) {
        const routeStart = route.route[i]
        const routeEnd = route.route[i + 1]

        // Only check intersection if we're on the same layer
        if (routeStart.z === start.z && routeEnd.z === start.z) {
          if (
            doSegmentsIntersect(
              { x: start.x, y: start.y },
              { x: end.x, y: end.y },
              { x: routeStart.x, y: routeStart.y },
              { x: routeEnd.x, y: routeEnd.y },
            )
          ) {
            return false
          }
        }
      }
    }

    return true
  }

  _step() {
    // If we've reached the end of the path, we're done
    if (this.tailDistanceAlongPath >= this.totalPathLength) {
      // Make sure to add the last point if needed
      const lastPoint = this.inputRoute.route[this.inputRoute.route.length - 1]
      if (
        this.newRoute.length === 0 ||
        !this.arePointsEqual(this.newRoute[this.newRoute.length - 1], lastPoint)
      ) {
        this.newRoute.push(lastPoint)
      }
      this.solved = true
      return
    }

    // Special case: If head reaches the end, check if we can draw a straight line from tail to end
    if (this.headDistanceAlongPath >= this.totalPathLength) {
      const tailPoint = this.getPointAtDistance(this.tailDistanceAlongPath)
      const endPoint = this.inputRoute.route[this.inputRoute.route.length - 1]

      // Check if direct path from tail to end is valid
      if (this.isValidPath([tailPoint, endPoint])) {
        // Add tail point if not already added
        if (
          this.newRoute.length === 0 ||
          !this.arePointsEqual(
            this.newRoute[this.newRoute.length - 1],
            tailPoint,
          )
        ) {
          this.newRoute.push(tailPoint)
        }

        // Add end point
        this.newRoute.push(endPoint)
        this.solved = true
        return
      }
    }

    // Increment head distance but don't go past the end of the path
    this.headDistanceAlongPath = Math.min(
      this.headDistanceAlongPath + this.stepSize,
      this.totalPathLength,
    )

    // Get the points between tail and head distances
    const tailPoint = this.getPointAtDistance(this.tailDistanceAlongPath)
    const headPoint = this.getPointAtDistance(this.headDistanceAlongPath)

    // Check for layer changes between tail and head
    const tailIndex = this.getNearestIndexForDistance(
      this.tailDistanceAlongPath,
    )
    const headIndex = this.getNearestIndexForDistance(
      this.headDistanceAlongPath,
    )

    // If there's a potential layer change in this segment
    let hasLayerChange = false
    let layerChangeDistance = -1

    for (let i = tailIndex; i < headIndex; i++) {
      if (
        i + 1 < this.inputRoute.route.length &&
        this.inputRoute.route[i].z !== this.inputRoute.route[i + 1].z
      ) {
        hasLayerChange = true
        // Find the segment with the layer change
        const changeSegmentIndex = i
        layerChangeDistance =
          this.pathSegments[changeSegmentIndex].startDistance
        break
      }
    }

    // If there's a layer change, handle it
    if (hasLayerChange && layerChangeDistance > 0) {
      // Get points before and after layer change
      const pointBeforeChange = this.getPointAtDistance(layerChangeDistance)
      const pointAfterChange =
        this.inputRoute.route[
          this.getNearestIndexForDistance(layerChangeDistance) + 1
        ]

      // Add the point before change if not already added
      if (
        this.newRoute.length === 0 ||
        !this.arePointsEqual(
          this.newRoute[this.newRoute.length - 1],
          pointBeforeChange,
        )
      ) {
        this.newRoute.push(pointBeforeChange)
      }

      // Add a via at the layer change point
      this.newVias.push({
        x: pointAfterChange.x,
        y: pointAfterChange.y,
      })

      // Add the point after change
      this.newRoute.push(pointAfterChange)

      // Update tail to the layer change point
      this.tailDistanceAlongPath =
        layerChangeDistance +
        this.pathSegments[this.getNearestIndexForDistance(layerChangeDistance)]
          .length
      this.headDistanceAlongPath = this.tailDistanceAlongPath
      return
    }

    // Check if a direct path from tail to head is valid
    if (this.isValidPath([tailPoint, headPoint])) {
      // Valid path, continue expanding
      return
    }

    // Path is not valid, add the middle segment
    const midDistance =
      this.tailDistanceAlongPath +
      (this.headDistanceAlongPath - this.tailDistanceAlongPath) / 2
    const midPoint = this.getPointAtDistance(midDistance)

    // Add the tail point if not already added
    if (
      this.newRoute.length === 0 ||
      !this.arePointsEqual(this.newRoute[this.newRoute.length - 1], tailPoint)
    ) {
      this.newRoute.push(tailPoint)
    }

    // If midpoint is different from tail, add it and update tail
    if (midDistance > this.tailDistanceAlongPath) {
      this.tailDistanceAlongPath = midDistance
    }
    // If we can't advance further, force a small advance
    else if (this.tailDistanceAlongPath < this.totalPathLength) {
      this.tailDistanceAlongPath += this.stepSize
    }

    this.headDistanceAlongPath = this.tailDistanceAlongPath
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }

    // Visualize the original route in red
    for (let i = 0; i < this.inputRoute.route.length - 1; i++) {
      graphics.lines!.push({
        points: [
          { x: this.inputRoute.route[i].x, y: this.inputRoute.route[i].y },
          {
            x: this.inputRoute.route[i + 1].x,
            y: this.inputRoute.route[i + 1].y,
          },
        ],
        strokeColor: "rgba(255, 0, 0, 0.8)",
        strokeDash: this.inputRoute.route[i].z === 1 ? "5, 5" : undefined,
      })
    }

    // Visualize the simplified route in green
    for (let i = 0; i < this.newRoute.length - 1; i++) {
      graphics.lines!.push({
        points: [
          { x: this.newRoute[i].x, y: this.newRoute[i].y },
          { x: this.newRoute[i + 1].x, y: this.newRoute[i + 1].y },
        ],
        strokeWidth: 0.15,
        strokeColor: "rgba(0, 255, 0, 0.8)",
      })
    }

    // Visualize vias
    for (const via of this.newVias) {
      graphics.circles!.push({
        center: via,
        radius: this.inputRoute.viaDiameter / 2,
        fill: "rgba(0, 0, 255, 0.5)",
      })
    }

    // Visualize obstacles
    for (const obstacle of this.obstacles) {
      graphics.rects!.push({
        center: obstacle.center,
        width: obstacle.width,
        height: obstacle.height,
        fill: obstacle.layers?.includes("top")
          ? "rgba(255, 0, 0, 0.3)"
          : obstacle.layers?.includes("bottom")
            ? "rgba(0, 0, 255, 0.3)"
            : "rgba(128, 128, 128, 0.3)",
      })
    }

    // Visualize other routes as obstacles (in purple)
    for (const route of this.otherHdRoutes) {
      for (let i = 0; i < route.route.length - 1; i++) {
        graphics.lines!.push({
          points: [
            { x: route.route[i].x, y: route.route[i].y },
            { x: route.route[i + 1].x, y: route.route[i + 1].y },
          ],
          strokeWidth: 0.15,
          strokeColor:
            route.route[i].z === 0
              ? "rgba(255, 0, 255, 0.5)" // top layer (purple)
              : route.route[i].z === 1
                ? "rgba(128, 0, 128, 0.5)" // inner layer (darker purple)
                : "rgba(0, 0, 255, 0.5)", // bottom layer (blue)
        })
      }
    }

    // Highlight current head and tail positions
    const tailPoint = this.getPointAtDistance(this.tailDistanceAlongPath)
    const headPoint = this.getPointAtDistance(this.headDistanceAlongPath)

    graphics.circles!.push({
      center: {
        x: tailPoint.x,
        y: tailPoint.y,
      },
      radius: 0.2,
      fill: "yellow",
      label: "Tail",
    })

    graphics.circles!.push({
      center: {
        x: headPoint.x,
        y: headPoint.y,
      },
      radius: 0.2,
      fill: "orange",
      label: "Head",
    })

    // Add visualization of the path segments
    let distance = 0
    while (distance < this.totalPathLength) {
      const point = this.getPointAtDistance(distance)
      graphics.circles!.push({
        center: {
          x: point.x,
          y: point.y,
        },
        radius: 0.05,
        fill: "rgba(100, 100, 100, 0.5)",
      })
      distance += this.totalPathLength / 20 // Show 20 markers along the path
    }

    return graphics
  }
}
