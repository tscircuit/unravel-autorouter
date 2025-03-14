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

export class SingleSimplifiedPathSolver2 extends SingleSimplifiedPathSolver {
  constructor(
    params: ConstructorParameters<typeof SingleSimplifiedPathSolver>[0],
  ) {
    super(params)

    // Handle empty or single-point routes
    if (this.inputRoute.route.length <= 1) {
      this.newRoute = [...this.inputRoute.route]
      this.solved = true
    }
  }

  // Helper to check if two points are the same
  private arePointsEqual(p1: Point, p2: Point): boolean {
    return p1.x === p2.x && p1.y === p2.y && p1.z === p2.z
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
    // If we've reached the end of the route, we're done
    if (this.tailIndex >= this.inputRoute.route.length - 1) {
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

    // Increment head index but don't go past the end of the route
    this.headIndex = Math.min(
      this.headIndex + 1,
      this.inputRoute.route.length - 1,
    )

    // Get points from tail to head
    const pointsToCheck = this.inputRoute.route.slice(
      this.tailIndex,
      this.headIndex + 1,
    )

    // Check for layer changes
    let layerChangeIndex = -1
    for (let i = 1; i < pointsToCheck.length; i++) {
      if (pointsToCheck[i].z !== pointsToCheck[i - 1].z) {
        layerChangeIndex = i
        break
      }
    }

    // If there's a layer change, handle it
    if (layerChangeIndex !== -1) {
      // Add points up to the layer change
      const pointBeforeChange = pointsToCheck[layerChangeIndex - 1]
      const pointAfterChange = pointsToCheck[layerChangeIndex]

      // If the point before change isn't already the last point in our new route, add it
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
      this.tailIndex += layerChangeIndex
      this.headIndex = this.tailIndex
      return
    }

    // Check if a direct path from tail to head is valid
    if (
      this.isValidPath([
        this.inputRoute.route[this.tailIndex],
        this.inputRoute.route[this.headIndex],
      ])
    ) {
      // Valid path, continue expanding
      return
    }

    // Path is not valid, add the middle segment
    const midpointIndex =
      this.tailIndex + Math.ceil((this.headIndex - this.tailIndex) / 2)

    // Add the tail point if not already added
    if (
      this.newRoute.length === 0 ||
      !this.arePointsEqual(
        this.newRoute[this.newRoute.length - 1],
        this.inputRoute.route[this.tailIndex],
      )
    ) {
      this.newRoute.push(this.inputRoute.route[this.tailIndex])
    }

    // If midpoint is different from tail, add it and update tail
    if (midpointIndex > this.tailIndex) {
      this.tailIndex = midpointIndex
    }
    // If we can't advance further, force advance anyway
    else if (this.tailIndex < this.inputRoute.route.length - 1) {
      this.tailIndex++
    }

    this.headIndex = this.tailIndex
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

    // Highlight current head and tail
    if (this.tailIndex < this.inputRoute.route.length) {
      graphics.circles!.push({
        center: {
          x: this.inputRoute.route[this.tailIndex].x,
          y: this.inputRoute.route[this.tailIndex].y,
        },
        radius: 0.2,
        fill: "yellow",
        label: "Tail",
      })
    }

    if (this.headIndex < this.inputRoute.route.length) {
      graphics.circles!.push({
        center: {
          x: this.inputRoute.route[this.headIndex].x,
          y: this.inputRoute.route[this.headIndex].y,
        },
        radius: 0.2,
        fill: "orange",
        label: "Head",
      })
    }

    return graphics
  }
}
