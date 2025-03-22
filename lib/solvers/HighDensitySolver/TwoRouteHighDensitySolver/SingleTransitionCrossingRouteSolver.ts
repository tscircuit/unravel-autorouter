import { BaseSolver } from "lib/solvers/BaseSolver"
import {
  NodeWithPortPoints,
  HighDensityIntraNodeRoute,
} from "lib/types/high-density-types"
import {
  distance,
  pointToSegmentDistance,
  doSegmentsIntersect,
} from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { getIntraNodeCrossings } from "lib/utils/getIntraNodeCrossings"
import { findCircleLineIntersections } from "./findCircleLineIntersections"

type Point = { x: number; y: number; z?: number }
type Route = {
  startPort: Point
  endPort: Point
  connectionName: string
}

export class SingleTransitionCrossingRouteSolver extends BaseSolver {
  // Input parameters
  nodeWithPortPoints: NodeWithPortPoints
  routes: Route[]

  // Configuration parameters
  viaDiameter: number
  traceThickness: number
  obstacleMargin: number
  layerCount: number = 2

  debugViaPositions: {
    via: Point
  }[]

  // Solution state
  solvedRoutes: HighDensityIntraNodeRoute[] = []

  // Bounds
  bounds: { minX: number; maxX: number; minY: number; maxY: number }

  constructor(params: {
    nodeWithPortPoints: NodeWithPortPoints
    viaDiameter?: number
    traceThickness?: number
    obstacleMargin?: number
    layerCount?: number
  }) {
    super()

    this.nodeWithPortPoints = params.nodeWithPortPoints
    this.viaDiameter = params?.viaDiameter ?? 0.6
    this.traceThickness = params?.traceThickness ?? 0.15
    this.obstacleMargin = params?.obstacleMargin ?? 0.1
    this.layerCount = params?.layerCount ?? 2
    this.debugViaPositions = []

    // Extract routes from the node data
    this.routes = this.extractRoutesFromNode()

    // Calculate bounds
    this.bounds = this.calculateBounds()

    if (this.routes.length !== 2) {
      this.failed = true
      return
    }

    const [routeA, routeB] = this.routes

    // Check if one route has a layer transition and the other doesn't
    const routeAHasTransition = routeA.startPort.z !== routeA.endPort.z
    const routeBHasTransition = routeB.startPort.z !== routeB.endPort.z

    // We need exactly one route with a transition
    if (
      (routeAHasTransition && routeBHasTransition) ||
      (!routeAHasTransition && !routeBHasTransition)
    ) {
      this.failed = true
      return
    }
  }

  /**
   * Extract routes that need to be connected from the node data
   */
  private extractRoutesFromNode(): Route[] {
    const routes: Route[] = []
    const connectedPorts = this.nodeWithPortPoints.portPoints!

    // Group ports by connection name
    const connectionGroups = new Map<string, Point[]>()

    for (const connectedPort of connectedPorts) {
      const { connectionName } = connectedPort
      if (!connectionGroups.has(connectionName)) {
        connectionGroups.set(connectionName, [])
      }
      connectionGroups.get(connectionName)?.push(connectedPort)
    }

    // Create routes for each connection (assuming each connection has exactly 2 points)
    for (const [connectionName, points] of connectionGroups.entries()) {
      if (points.length === 2) {
        routes.push({
          startPort: { ...points[0], z: points[0].z ?? 0 },
          endPort: { ...points[1], z: points[1].z ?? 0 },
          connectionName,
        })
      }
    }

    return routes
  }

  /**
   * Calculate the bounding box of the node
   */
  private calculateBounds() {
    return {
      minX:
        this.nodeWithPortPoints.center.x - this.nodeWithPortPoints.width / 2,
      maxX:
        this.nodeWithPortPoints.center.x + this.nodeWithPortPoints.width / 2,
      minY:
        this.nodeWithPortPoints.center.y - this.nodeWithPortPoints.height / 2,
      maxY:
        this.nodeWithPortPoints.center.y + this.nodeWithPortPoints.height / 2,
    }
  }

  /**
   * Check if two routes are crossing
   */
  private doRoutesCross(routeA: Route, routeB: Route): boolean {
    // For this specific solver, we want to check if the 2D projections intersect
    // (ignoring z values)
    return doSegmentsIntersect(
      routeA.startPort,
      routeA.endPort,
      routeB.startPort,
      routeB.endPort,
    )
  }

  private calculateViaPosition(
    transitionRoute: Route,
    flatRoute: Route,
  ): Point | null {
    // Define outer box as the bounds where all points lie
    const outerBox = {
      width: this.bounds.maxX - this.bounds.minX,
      height: this.bounds.maxY - this.bounds.minY,
      x: this.bounds.minX,
      y: this.bounds.minY,
    }

    // Define inner box with padding of obstacleMargin
    const innerBox = {
      width: outerBox.width - 2 * this.obstacleMargin - this.viaDiameter,
      height: outerBox.height - 2 * this.obstacleMargin - this.viaDiameter,
      x: outerBox.x + this.obstacleMargin + this.viaDiameter / 2,
      y: outerBox.y + this.obstacleMargin + this.viaDiameter / 2,
    }

    // Define the K1 parameter (minimum distance from flat route to via)
    // We'll use viaDiameter + obstacleMargin as the minimum distance
    const K1 = this.viaDiameter + this.obstacleMargin

    // Get points from the flat route
    const flatA = flatRoute.startPort
    const flatB = flatRoute.endPort

    // Get the inner box corners
    const corners = [
      { x: innerBox.x, y: innerBox.y }, // Top-left (0)
      { x: innerBox.x + innerBox.width, y: innerBox.y }, // Top-right (1)
      { x: innerBox.x + innerBox.width, y: innerBox.y + innerBox.height }, // Bottom-right (2)
      { x: innerBox.x, y: innerBox.y + innerBox.height }, // Bottom-left (3)
    ]

    // Find all valid candidate points
    const candidatePoints: Array<
      Point & { type: string; index?: number; edge?: number }
    > = []

    // 1. Check which corners are valid (minimum distance K1 from flat route)
    corners.forEach((corner, index) => {
      if (pointToSegmentDistance(corner, flatA, flatB) >= K1) {
        candidatePoints.push({ ...corner, type: "corner", index })
      }
    })

    // 2. Find intersections of K1 distance from flat route with the inner box edges
    // Define the 4 edges of the inner box
    const edges = [
      { p1: corners[0], p2: corners[1] }, // top
      { p1: corners[1], p2: corners[2] }, // right
      { p1: corners[2], p2: corners[3] }, // bottom
      { p1: corners[3], p2: corners[0] }, // left
    ]

    // Find points on each edge that are at distance K1 from the flat route
    // This is a simplification - in a complete solution we would need to
    // calculate the equidistant line from the flat route and find
    // its intersections with the inner box edges

    // If we have fewer than 1 candidate point, relax the constraints
    if (candidatePoints.length < 1) {
      // Try with smaller K1
      const relaxedK1 = K1 * 0.8 // Reduce by 20%
      corners.forEach((corner, index) => {
        if (
          pointToSegmentDistance(corner, flatA, flatB) >= relaxedK1 &&
          !candidatePoints.some((p) => p.x === corner.x && p.y === corner.y)
        ) {
          candidatePoints.push({ ...corner, type: "relaxed_corner", index })
        }
      })

      // If still not enough, add corners sorted by distance from flat route
      if (candidatePoints.length < 1) {
        // Sort corners by their distance from flat route
        const sortedCorners = [...corners].sort((a, b) => {
          const aDist = pointToSegmentDistance(a, flatA, flatB)
          const bDist = pointToSegmentDistance(b, flatA, flatB)
          return bDist - aDist // Larger distances first
        })

        // Add corners not already in candidatePoints
        for (const corner of sortedCorners) {
          if (
            !candidatePoints.some((p) => p.x === corner.x && p.y === corner.y)
          ) {
            candidatePoints.push({ ...corner, type: "forced_corner" })
            if (candidatePoints.length >= 1) break
          }
        }
      }
    }

    // If still no candidates, return null
    if (candidatePoints.length < 1) {
      return null
    }

    // Choose the candidate that's closest to the intersection point of the routes
    // Find the intersection point
    // This is a simplification - we'd need proper line intersection calculation
    // for a complete solution
    const intersection = this.findIntersectionPoint(
      transitionRoute.startPort,
      transitionRoute.endPort,
      flatRoute.startPort,
      flatRoute.endPort,
    )

    // Sort candidates by distance to intersection
    const sortedCandidates = [...candidatePoints].sort((a, b) => {
      const aDist = distance(a, intersection)
      const bDist = distance(b, intersection)
      return aDist - bDist // Smaller distances first
    })

    return sortedCandidates[0]
  }

  private findIntersectionPoint(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point,
  ): Point {
    // Calculate the intersection of two line segments
    // formula from https://en.wikipedia.org/wiki/Line–line_intersection
    const x1 = p1.x,
      y1 = p1.y
    const x2 = p2.x,
      y2 = p2.y
    const x3 = p3.x,
      y3 = p3.y
    const x4 = p4.x,
      y4 = p4.y

    const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)

    // Check if lines are parallel
    if (Math.abs(denominator) < 0.001) {
      // Return midpoint as a fallback
      return {
        x: (x1 + x2 + x3 + x4) / 4,
        y: (y1 + y2 + y3 + y4) / 4,
      }
    }

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator

    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1),
    }
  }

  /**
   * Create a single transition route with properly placed via
   */
  private createTransitionRoute(
    start: Point,
    end: Point,
    via: Point,
    connectionName: string,
  ): HighDensityIntraNodeRoute {
    // Create the route path with layer transition at the via
    const route = [
      { x: start.x, y: start.y, z: start.z ?? 0 },
      { x: via.x, y: via.y, z: start.z ?? 0 },
      { x: via.x, y: via.y, z: end.z ?? 0 },
      { x: end.x, y: end.y, z: end.z ?? 0 },
    ]

    return {
      connectionName,
      route,
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      vias: [via],
    }
  }

  /**
   * Create the non-transition route
   */
  private createFlatRoute(
    flatStart: Point,
    flatEnd: Point,
    via: Point,
    otherRouteStart: Point,
    otherRouteEnd: Point,
    flatRouteConnectionName: string,
  ): HighDensityIntraNodeRoute {
    // We need to navigate around the via

    const middle = (a: Point, b: Point) => {
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      }
    }

    const middleWithMargin = (
      a: Point,
      aMargin: number,
      b: Point,
      bMargin: number,
    ) => {
      const dx = b.x - a.x
      const dy = b.y - a.y

      const effectiveA = {
        x: a.x + dx * aMargin,
        y: a.y + dy * aMargin,
      }

      const effectiveB = {
        x: b.x - dx * bMargin,
        y: b.y - dy * bMargin,
      }

      return middle(effectiveA, effectiveB)
    }

    const p1 = middleWithMargin(flatStart, 0.15, via, 0.6)
    const p2 = middleWithMargin(
      via,
      0.6,
      otherRouteStart.z !== flatStart.z ? otherRouteStart : otherRouteEnd,
      0.15,
    )
    const p3 = middleWithMargin(flatEnd, 0.15, via, 0.6)

    // We need to navigate around the via
    return {
      connectionName: flatRouteConnectionName,
      route: [
        { x: flatStart.x, y: flatStart.y, z: flatStart.z ?? 0 },
        { x: p1.x, y: p1.y, z: flatStart.z ?? 0 },
        { x: p2.x, y: p2.y, z: flatStart.z ?? 0 },
        { x: p3.x, y: p3.y, z: flatStart.z ?? 0 },
        { x: flatEnd.x, y: flatEnd.y, z: flatEnd.z ?? 0 },
      ],
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      vias: [],
    }
  }

  /**
   * Try to solve with one route having a transition and the other staying flat
   */
  private trySolve(): boolean {
    const [routeA, routeB] = this.routes

    // Determine which route has the transition
    const routeAHasTransition = routeA.startPort.z !== routeA.endPort.z

    const transitionRoute = routeAHasTransition ? routeA : routeB
    const flatRoute = routeAHasTransition ? routeB : routeA

    const viaPosition = this.calculateViaPosition(transitionRoute, flatRoute)
    if (viaPosition) {
      this.debugViaPositions.push({ via: viaPosition })
    } else {
      return false
    }

    // Create transition route with via
    const transitionRouteSolution = this.createTransitionRoute(
      transitionRoute.startPort,
      transitionRoute.endPort,
      viaPosition,
      transitionRoute.connectionName,
    )

    // Create flat route
    const flatRouteSolution = this.createFlatRoute(
      flatRoute.startPort,
      flatRoute.endPort,
      viaPosition,
      transitionRoute.startPort,
      transitionRoute.endPort,
      flatRoute.connectionName,
    )

    this.solvedRoutes.push(transitionRouteSolution, flatRouteSolution)
    return true
  }

  /**
   * Main step method that attempts to solve the routes
   */
  _step() {
    // Check if routes are actually crossing
    if (!this.doRoutesCross(this.routes[0], this.routes[1])) {
      // Routes don't cross, create simple direct connections
      const routeASolution = this.createFlatRoute(
        this.routes[0].startPort,
        this.routes[0].endPort,
        this.routes[0].connectionName,
      )

      const routeBSolution = this.createFlatRoute(
        this.routes[1].startPort,
        this.routes[1].endPort,
        this.routes[1].connectionName,
      )

      this.solvedRoutes.push(routeASolution, routeBSolution)
      this.solved = true
      return
    }

    // Try to solve
    if (this.trySolve()) {
      this.solved = true
      return
    }

    // If approach fails, mark as failed
    this.failed = true
  }

  /**
   * Visualization for debugging
   */
  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Draw PCB bounds
    graphics.rects!.push({
      center: {
        x: (this.bounds.minX + this.bounds.maxX) / 2,
        y: (this.bounds.minY + this.bounds.maxY) / 2,
      },
      width: this.bounds.maxX - this.bounds.minX,
      height: this.bounds.maxY - this.bounds.minY,
      stroke: "rgba(0, 0, 0, 0.5)",
      fill: "rgba(240, 240, 240, 0.1)",
      label: "PCB Bounds",
    })

    // Draw original routes
    for (const route of this.routes) {
      // Draw endpoints
      graphics.points!.push({
        x: route.startPort.x,
        y: route.startPort.y,
        label: `${route.connectionName} start (z=${route.startPort.z})`,
        color: "orange",
      })

      graphics.points!.push({
        x: route.endPort.x,
        y: route.endPort.y,
        label: `${route.connectionName} end (z=${route.endPort.z})`,
        color: "orange",
      })

      // Draw direct connection line
      graphics.lines!.push({
        points: [route.startPort, route.endPort],
        strokeColor: "rgba(255, 0, 0, 0.5)",
        label: `${route.connectionName} direct`,
      })
    }

    // Draw debug via positions (even if solution failed)
    for (let i = 0; i < this.debugViaPositions.length; i++) {
      const { via } = this.debugViaPositions[i]

      // Draw computed via
      graphics.circles!.push({
        center: via,
        radius: this.viaDiameter / 2,
        fill: "rgba(255, 165, 0, 0.7)",
        stroke: "rgba(0, 0, 0, 0.5)",
        label: `Computed Via (attempt ${i + 1})`,
      })

      // Draw safety margin around via
      const safetyMargin = this.viaDiameter / 2 + this.obstacleMargin
      graphics.circles!.push({
        center: via,
        radius: safetyMargin,
        stroke: "rgba(255, 165, 0, 0.7)",
        fill: "rgba(0, 0, 0, 0)",
        label: "Safety Margin",
      })
    }

    // Draw solved routes if available
    for (let si = 0; si < this.solvedRoutes.length; si++) {
      const route = this.solvedRoutes[si]
      const routeColor =
        si % 2 === 0 ? "rgba(0, 255, 0, 0.75)" : "rgba(255, 0, 255, 0.75)"
      for (let i = 0; i < route.route.length - 1; i++) {
        const pointA = route.route[i]
        const pointB = route.route[i + 1]

        graphics.lines!.push({
          points: [pointA, pointB],
          strokeColor: routeColor,
          strokeDash: pointA.z !== route.route[0].z ? [0.2, 0.2] : undefined,
          strokeWidth: route.traceThickness,
          label: `${route.connectionName} z=${pointA.z}`,
        })
      }

      // Draw vias in solved routes
      for (const via of route.vias) {
        graphics.circles!.push({
          center: via,
          radius: this.viaDiameter / 2,
          fill: "rgba(0, 0, 255, 0.8)",
          stroke: "black",
          label: "Solved Via",
        })
        graphics.circles!.push({
          center: via,
          radius: this.viaDiameter / 2 + this.obstacleMargin,
          fill: "rgba(0, 0, 255, 0.3)",
          stroke: "black",
          label: "Via Margin",
        })
      }
    }

    return graphics
  }

  /**
   * Get the solved routes
   */
  getSolvedRoutes(): HighDensityIntraNodeRoute[] {
    return this.solvedRoutes
  }
}
