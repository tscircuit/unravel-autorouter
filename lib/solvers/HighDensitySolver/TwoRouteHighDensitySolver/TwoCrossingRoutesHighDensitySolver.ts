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

export class TwoCrossingRoutesHighDensitySolver extends BaseSolver {
  // Input parameters
  nodeWithPortPoints: NodeWithPortPoints
  routes: Route[]

  // Configuration parameters
  viaDiameter: number
  traceThickness: number
  obstacleMargin: number
  layerCount: number = 2

  debugViaPositions: {
    via1: Point
    via2: Point
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
    const routeAStartsAndEndsOnSameLayer =
      routeA.startPort.z === routeA.endPort.z
    if (!routeAStartsAndEndsOnSameLayer) {
      this.failed = true
      return
    }

    const routeBStartsAndEndsOnSameLayer =
      routeB.startPort.z === routeB.endPort.z
    if (!routeBStartsAndEndsOnSameLayer) {
      this.failed = true
      return
    }

    const routesAreSameLayer = routeA.startPort.z === routeB.startPort.z
    if (!routesAreSameLayer) {
      this.failed = true
      return
    }

    // TODO check to make sure the lines cross
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
    return doSegmentsIntersect(
      routeA.startPort,
      routeA.endPort,
      routeB.startPort,
      routeB.endPort,
    )
  }

  private calculateViaPositions(
    routeA: Route,
    routeB: Route,
  ): {
    via1: Point
    via2: Point
  } | null {
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

    // Define the K1 parameter (minimum distance from A/B to C/D)
    // We'll use viaDiameter + obstacleMargin as the minimum distance
    const K1 = this.viaDiameter + this.obstacleMargin

    // Get points A and B from the routeB
    const pointA = routeB.startPort
    const pointB = routeB.endPort

    // Get the inner box corners
    const corners = [
      { x: innerBox.x, y: innerBox.y }, // Top-left (0)
      { x: innerBox.x + innerBox.width, y: innerBox.y }, // Top-right (1)
      { x: innerBox.x + innerBox.width, y: innerBox.y + innerBox.height }, // Bottom-right (2)
      { x: innerBox.x, y: innerBox.y + innerBox.height }, // Bottom-left (3)
    ]

    // Calculate distance between two points
    const distanceBetween = (p1: Point, p2: Point): number => {
      return distance(p1, p2)
    }

    // Find all valid candidate points
    const candidatePoints: Array<
      Point & { type: string; index?: number; circle?: number; edge?: number }
    > = []

    // 1. First check which corners are valid (outside both K1 circles)
    corners.forEach((corner, index) => {
      if (
        distanceBetween(corner, pointA) >= K1 &&
        distanceBetween(corner, pointB) >= K1
      ) {
        candidatePoints.push({ ...corner, type: "corner", index })
      }
    })

    // 2. Find intersections of K1 circles with the inner box edges
    // Define the 4 edges of the inner box
    const edges = [
      { p1: corners[0], p2: corners[1] }, // top
      { p1: corners[1], p2: corners[2] }, // right
      { p1: corners[2], p2: corners[3] }, // bottom
      { p1: corners[3], p2: corners[0] }, // left
    ]

    // Find intersections for both circles with all edges
    ;[pointA, pointB].forEach((circleCenter, circleIndex) => {
      edges.forEach((edge, edgeIndex) => {
        const intersections = findCircleLineIntersections(
          { ...circleCenter, r: K1 },
          edge,
        )

        // For each intersection, check if it's also outside the other circle
        intersections.forEach((point) => {
          const otherCircle = circleIndex === 0 ? pointB : pointA
          if (distanceBetween(point, otherCircle) >= K1) {
            candidatePoints.push({
              ...point,
              type: "intersection",
              circle: circleIndex,
              edge: edgeIndex,
            })
          }
        })
      })
    })

    // If we have fewer than 2 candidate points, relax the constraints
    if (candidatePoints.length < 2) {
      // Try with smaller K1
      const relaxedK1 = K1 * 0.8 // Reduce by 20%
      corners.forEach((corner, index) => {
        if (
          distanceBetween(corner, pointA) >= relaxedK1 &&
          distanceBetween(corner, pointB) >= relaxedK1 &&
          !candidatePoints.some((p) => p.x === corner.x && p.y === corner.y)
        ) {
          candidatePoints.push({ ...corner, type: "relaxed_corner", index })
        }
      })

      // If still not enough, add corners sorted by distance
      if (candidatePoints.length < 2) {
        // Sort corners by their distance from A and B
        const sortedCorners = [...corners].sort((a, b) => {
          const aMinDist = Math.min(
            distanceBetween(a, pointA),
            distanceBetween(a, pointB),
          )
          const bMinDist = Math.min(
            distanceBetween(b, pointA),
            distanceBetween(b, pointB),
          )
          return bMinDist - aMinDist // Larger distances first
        })

        // Add corners not already in candidatePoints
        for (const corner of sortedCorners) {
          if (
            !candidatePoints.some((p) => p.x === corner.x && p.y === corner.y)
          ) {
            candidatePoints.push({ ...corner, type: "forced_corner" })
            if (candidatePoints.length >= 2) break
          }
        }
      }
    }

    // If still fewer than 2 candidates, return null
    if (candidatePoints.length < 2) {
      return null
    }

    // Find the pair of points with maximum distance between them
    let maxDist = 0
    let optimalPair = [
      candidatePoints[0],
      candidatePoints[candidatePoints.length > 1 ? 1 : 0],
    ]

    for (let i = 0; i < candidatePoints.length; i++) {
      for (let j = i + 1; j < candidatePoints.length; j++) {
        const dist = distanceBetween(candidatePoints[i], candidatePoints[j])
        if (dist > maxDist) {
          maxDist = dist
          optimalPair = [candidatePoints[i], candidatePoints[j]]
        }
      }
    }

    let via1 = { x: optimalPair[0].x, y: optimalPair[0].y }
    let via2 = { x: optimalPair[1].x, y: optimalPair[1].y }

    const via1DistToStart = distance(via1, routeA.startPort)
    const via2DistToStart = distance(via2, routeA.startPort)

    if (via2DistToStart < via1DistToStart) {
      ;[via1, via2] = [via2, via1]
    }

    return {
      via1,
      via2,
    }
  }

  /**
   * Create a route with properly placed vias
   */
  private createRoute(
    start: Point,
    end: Point,
    via1: Point,
    via2: Point,
    connectionName: string,
  ): HighDensityIntraNodeRoute {
    const middleZ = start.z === 0 ? 1 : 0

    // Create the route path with layer transitions
    const route = [
      { x: start.x, y: start.y, z: start.z ?? 0 },
      { x: via1.x, y: via1.y, z: start.z ?? 0 },
      { x: via1.x, y: via1.y, z: middleZ }, // Via transition to layer 1
      { x: via2.x, y: via2.y, z: middleZ }, // Stay on layer 1
      { x: via2.x, y: via2.y, z: end.z ?? 0 }, // Via transition back
      { x: end.x, y: end.y, z: end.z ?? 0 },
    ]

    return {
      connectionName,
      route,
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      vias: [via1, via2],
    }
  }

  /**
   * Try to solve with routeA going over and routeB staying on layer 0
   */
  private trySolveAOverB(routeA: Route, routeB: Route): boolean {
    const viaPositions = this.calculateViaPositions(routeA, routeB)
    if (viaPositions) {
      this.debugViaPositions.push(viaPositions)
    } else {
      return false
    }

    const { via1, via2 } = this.optimizeViaPositions(viaPositions)

    // if (
    //   distance(via1, via2) <
    //   this.viaDiameter + this.traceThickness + this.obstacleMargin * 2
    // ) {
    //   return false
    // }

    // Create route for A that goes over B using vias
    const routeASolution = this.createRoute(
      routeA.startPort,
      routeA.endPort,
      via1,
      via2,
      routeA.connectionName,
    )

    // Calculate orthogonal line through the middle segment of route A
    const midSegmentStart = { x: via1.x, y: via1.y, z: 1 }
    const midSegmentEnd = { x: via2.x, y: via2.y, z: 1 }

    // Calculate the orthogonal points for route B
    const orthogonalPoints =
      this.calculateShortestOrthogonalRoutePoints(
        routeB.startPort,
        routeB.endPort,
        midSegmentStart,
        midSegmentEnd,
        routeA.startPort,
        routeA.endPort,
      ) ??
      this.calculateConservativeOrthogonalRoutePoints(
        routeB.startPort,
        routeB.endPort,
        midSegmentStart,
        midSegmentEnd,
        routeA.startPort,
        routeA.endPort,
      )

    // Create route for B that navigates around the vias
    const routeBSolution: HighDensityIntraNodeRoute = {
      connectionName: routeB.connectionName,
      route: orthogonalPoints as any,
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      vias: [],
    }

    this.solvedRoutes.push(routeASolution, routeBSolution)
    return true
  }

  private optimizeViaPositions(viaPositions: { via1: Point; via2: Point }): {
    via1: Point
    via2: Point
  } {
    const { via1, via2 } = viaPositions

    // Calculate the minimum required distance between vias
    const minRequiredDistance =
      (this.viaDiameter + this.traceThickness + this.obstacleMargin) * 2

    // Calculate current distance between vias
    const currentDistance = distance(via1, via2)

    // If vias are already closer than or equal to the minimum required distance, return as is
    if (currentDistance <= minRequiredDistance) {
      return viaPositions
    }

    // Calculate the direction vector from viaA to viaB
    const dirX = via2.x - via1.x
    const dirY = via2.y - via1.y

    // Normalize the direction vector
    const dirLength = Math.sqrt(dirX * dirX + dirY * dirY)
    const normDirX = dirX / dirLength
    const normDirY = dirY / dirLength

    // Calculate the midpoint of the current vias
    const midpointX = (via1.x + via2.x) / 2
    const midpointY = (via1.y + via2.y) / 2

    // Calculate new positions that are minRequiredDistance apart
    // Move each via half the distance towards the midpoint
    const moveDistance = (currentDistance - minRequiredDistance) / 2

    const newVia1 = {
      x: via1.x + normDirX * moveDistance,
      y: via1.y + normDirY * moveDistance,
    }

    const newVia2 = {
      x: via2.x - normDirX * moveDistance,
      y: via2.y - normDirY * moveDistance,
    }

    return {
      via1: newVia1,
      via2: newVia2,
    }
  }

  /**
   * Calculate the orthogonal route points for the second route
   */
  private calculateConservativeOrthogonalRoutePoints(
    start: Point,
    end: Point,
    via1: Point,
    via2: Point,
    otherRouteStart: Point,
    otherRouteEnd: Point,
  ): Point[] | null {
    // Define the inner edge box which is obstacleMargin away from outer box
    const outerBox = {
      width: this.bounds.maxX - this.bounds.minX,
      height: this.bounds.maxY - this.bounds.minY,
      x: this.bounds.minX,
      y: this.bounds.minY,
    }

    const innerEdgeBox = {
      width: outerBox.width - 2 * this.obstacleMargin - this.traceThickness,
      height: outerBox.height - 2 * this.obstacleMargin - this.traceThickness,
      x: outerBox.x + this.obstacleMargin + this.traceThickness / 2,
      y: outerBox.y + this.obstacleMargin + this.traceThickness / 2,
    }

    // Calculate the orthogonal line to the mid segment
    // First get the direction vector of mid segment
    const midSegmentDX = via2.x - via1.x
    const midSegmentDY = via2.y - via1.y

    // Calculate orthogonal vector (rotate by 90 degrees)
    const orthDX = -midSegmentDY
    const orthDY = midSegmentDX

    // Normalize the orthogonal vector
    const orthLength = Math.sqrt(orthDX * orthDX + orthDY * orthDY)
    const normOrthDX = orthDX / orthLength
    const normOrthDY = orthDY / orthLength

    // Calculate the midpoint of the mid segment
    const midpointX = (via1.x + via2.x) / 2
    const midpointY = (via1.y + via2.y) / 2

    // Calculate the orthogonal line that passes through the midpoint
    // Line equation: (x, y) = (midpointX, midpointY) + t * (normOrthDX, normOrthDY)

    // Function to calculate intersections with the innerEdgeBox
    const calculateIntersections = (): Point[] => {
      const intersections: Point[] = []

      // Check intersection with left edge
      const leftT = (innerEdgeBox.x - midpointX) / normOrthDX
      const leftY = midpointY + leftT * normOrthDY
      if (
        leftY >= innerEdgeBox.y &&
        leftY <= innerEdgeBox.y + innerEdgeBox.height
      ) {
        intersections.push({ x: innerEdgeBox.x, y: leftY })
      }

      // Check intersection with right edge
      const rightT =
        (innerEdgeBox.x + innerEdgeBox.width - midpointX) / normOrthDX
      const rightY = midpointY + rightT * normOrthDY
      if (
        rightY >= innerEdgeBox.y &&
        rightY <= innerEdgeBox.y + innerEdgeBox.height
      ) {
        intersections.push({
          x: innerEdgeBox.x + innerEdgeBox.width,
          y: rightY,
        })
      }

      // Check intersection with top edge
      const topT = (innerEdgeBox.y - midpointY) / normOrthDY
      const topX = midpointX + topT * normOrthDX
      if (
        topX >= innerEdgeBox.x &&
        topX <= innerEdgeBox.x + innerEdgeBox.width
      ) {
        intersections.push({ x: topX, y: innerEdgeBox.y })
      }

      // Check intersection with bottom edge
      const bottomT =
        (innerEdgeBox.y + innerEdgeBox.height - midpointY) / normOrthDY
      const bottomX = midpointX + bottomT * normOrthDX
      if (
        bottomX >= innerEdgeBox.x &&
        bottomX <= innerEdgeBox.x + innerEdgeBox.width
      ) {
        intersections.push({
          x: bottomX,
          y: innerEdgeBox.y + innerEdgeBox.height,
        })
      }

      return intersections
    }

    const intersections = calculateIntersections()

    // If we don't have at least 2 intersections, return direct route
    if (intersections.length < 2) {
      return [
        { x: start.x, y: start.y, z: start.z ?? 0 },
        { x: end.x, y: end.y, z: end.z ?? 0 },
      ]
    }

    // Sort intersections by distance from start point
    const sortedIntersections = [...intersections].sort((a, b) => {
      const distA = distance(a, start)
      const distB = distance(b, start)
      return distA - distB
    })

    // Choose the closest intersection to the start and the closest to the end
    let middlePoint1 = sortedIntersections[0]
    let middlePoint2 = sortedIntersections[intersections.length - 1]

    if (
      doSegmentsIntersect(start, middlePoint1, otherRouteStart, via1) ||
      doSegmentsIntersect(end, middlePoint2, otherRouteEnd, via2)
    ) {
      ;[middlePoint1, middlePoint2] = [middlePoint2, middlePoint1]
    }

    // Create the route with 4 points
    return [
      { x: start.x, y: start.y, z: start.z ?? 0 },
      {
        x: middlePoint1.x,
        y: middlePoint1.y,
        z: start.z ?? 0,
        // @ts-ignore
        _label: "Conservative Orthogonal Point 1",
      },
      {
        x: middlePoint2.x,
        y: middlePoint2.y,
        z: start.z ?? 0,
        // @ts-ignore
        _label: "Conservative Orthogonal Point 2",
      },
      { x: end.x, y: end.y, z: end.z ?? 0 },
    ]
  }

  private calculateShortestOrthogonalRoutePoints(
    start: Point,
    end: Point,
    via1: Point,
    via2: Point,
    otherRouteStart: Point,
    otherRouteEnd: Point,
  ): Point[] | null {
    const midSegmentCenter = {
      x: (via1.x + via2.x) / 2,
      y: (via1.y + via2.y) / 2,
    }

    const midSegmentDirection = {
      x: via2.x - via1.x,
      y: via2.y - via1.y,
    }

    const midSegmentLength = distance(via1, via2)
    const normOrthDX = midSegmentDirection.y / midSegmentLength
    const normOrthDY = midSegmentDirection.x / midSegmentLength

    // Travel orthogonal to the mid segment by the length of the mid segment to
    // get two points
    let orthogonalPoint1 = {
      x: midSegmentCenter.x + (midSegmentLength / 2) * normOrthDY,
      y: midSegmentCenter.y - (midSegmentLength / 2) * normOrthDX,
    }

    let orthogonalPoint2 = {
      x: midSegmentCenter.x - (midSegmentLength / 2) * normOrthDY,
      y: midSegmentCenter.y + (midSegmentLength / 2) * normOrthDX,
    }

    if (distance(orthogonalPoint2, start) < distance(orthogonalPoint1, start)) {
      ;[orthogonalPoint1, orthogonalPoint2] = [
        orthogonalPoint2,
        orthogonalPoint1,
      ]
    }

    // Make sure we're not too close to the other route, or the mid segment
    // start or end (which has vias)
    // TODO - i haven't done this because we need a good test case/fixture -seve

    if (
      doSegmentsIntersect(start, orthogonalPoint1, otherRouteStart, via1) ||
      doSegmentsIntersect(end, orthogonalPoint2, otherRouteEnd, via2)
    ) {
      ;[orthogonalPoint1, orthogonalPoint2] = [
        orthogonalPoint2,
        orthogonalPoint1,
      ]
    }

    if (
      doSegmentsIntersect(start, orthogonalPoint2, otherRouteStart, via1) ||
      doSegmentsIntersect(end, orthogonalPoint1, otherRouteEnd, via2)
    ) {
      return null
    }

    return [
      { x: start.x, y: start.y, z: start.z ?? 0 },
      {
        x: orthogonalPoint1.x,
        y: orthogonalPoint1.y,
        z: start.z ?? 0,
        // @ts-ignore
        _label: "Orthogonal Point 1",
      },
      {
        x: orthogonalPoint2.x,
        y: orthogonalPoint2.y,
        z: start.z ?? 0,
        // @ts-ignore
        _label: "Orthogonal Point 2",
      },
      { x: end.x, y: end.y, z: end.z ?? 0 },
    ]
  }

  /**
   * Main step method that attempts to solve the two crossing routes
   */
  _step() {
    // Check if we have exactly two routes
    if (this.routes.length !== 2) {
      this.failed = true
      return
    }

    const [routeA, routeB] = this.routes

    // Check if routes are actually crossing
    if (!this.doRoutesCross(routeA, routeB)) {
      // Routes don't cross, create simple direct connections
      const routeASolution: HighDensityIntraNodeRoute = {
        connectionName: routeA.connectionName,
        route: [
          {
            x: routeA.startPort.x,
            y: routeA.startPort.y,
            z: routeA.startPort.z ?? 0,
          },
          {
            x: routeA.endPort.x,
            y: routeA.endPort.y,
            z: routeA.endPort.z ?? 0,
          },
        ],
        traceThickness: this.traceThickness,
        viaDiameter: this.viaDiameter,
        vias: [],
      }

      const routeBSolution: HighDensityIntraNodeRoute = {
        connectionName: routeB.connectionName,
        route: [
          {
            x: routeB.startPort.x,
            y: routeB.startPort.y,
            z: routeB.startPort.z ?? 0,
          },
          {
            x: routeB.endPort.x,
            y: routeB.endPort.y,
            z: routeB.endPort.z ?? 0,
          },
        ],
        traceThickness: this.traceThickness,
        viaDiameter: this.viaDiameter,
        vias: [],
      }

      this.solvedRoutes.push(routeASolution, routeBSolution)
      this.solved = true
      return
    }

    // Try having route A go over route B
    if (this.trySolveAOverB(routeA, routeB)) {
      this.solved = true
      return
    }

    // If that fails, try having route B go over route A
    if (this.trySolveAOverB(routeB, routeA)) {
      this.solved = true
      return
    }

    // If both approaches fail, mark as failed
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
    for (const [routeName, route] of [
      ["Route A", this.routes[0]],
      ["Route B", this.routes[1]],
    ]) {
      // Draw endpoints
      graphics.points!.push({
        x: route.startPort.x,
        y: route.startPort.y,
        label: `${routeName}\n${route.connectionName} start`,
        color: "orange",
      })

      graphics.points!.push({
        x: route.endPort.x,
        y: route.endPort.y,
        label: `${routeName}\n${route.connectionName} end`,
        color: "orange",
      })

      // Draw direct connection line
      graphics.lines!.push({
        points: [route.startPort, route.endPort],
        strokeColor: "rgba(255, 0, 0, 0.5)",
        label: `${routeName}\n${route.connectionName} direct`,
      })
    }

    // Draw debug via positions (even if solution failed)
    for (let i = 0; i < this.debugViaPositions.length; i++) {
      const { via1, via2 } = this.debugViaPositions[i]

      // Draw computed vias (using different colors for different attempts)
      const colors = ["rgba(255, 165, 0, 0.7)", "rgba(128, 0, 128, 0.7)"] // orange, purple
      const color = colors[i % colors.length]

      graphics.circles!.push({
        center: via1,
        radius: this.viaDiameter / 2,
        fill: color,
        stroke: "rgba(0, 0, 0, 0.5)",
        label: `Computed Via A (attempt ${i + 1})`,
      })

      graphics.circles!.push({
        center: via2,
        radius: this.viaDiameter / 2,
        fill: color,
        stroke: "rgba(0, 0, 0, 0.5)",
        label: `Computed Via B (attempt ${i + 1})`,
      })

      // Draw safety margins around vias
      const safetyMargin = this.viaDiameter / 2 + this.obstacleMargin
      graphics.circles!.push({
        center: via1,
        radius: safetyMargin,
        stroke: color,
        fill: "rgba(0, 0, 0, 0)",
        label: `Debug Via 1 Safety Margin (attempt ${i + 1})`,
      })

      graphics.circles!.push({
        center: via2,
        radius: safetyMargin,
        stroke: color,
        fill: "rgba(0, 0, 0, 0)",
        label: `Debug Via 2 Safety Margin (attempt ${i + 1})`,
      })

      // Draw potential route through vias
      graphics.lines!.push({
        points: [
          this.routes[i % 2].startPort,
          via1,
          via2,
          this.routes[i % 2].endPort,
        ],
        strokeColor: `${color.substring(0, color.lastIndexOf(","))}, 0.3)`,
        strokeDash: [5, 5],
        label: `Potential Route (attempt ${i + 1})`,
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
          strokeDash: pointA.z === 1 ? [0.2, 0.2] : undefined,
          strokeWidth: route.traceThickness,
          label: `${route.connectionName} z=${pointA.z}`,
        })

        if ((pointA as any)._label) {
          graphics.points!.push({
            x: pointA.x,
            y: pointA.y,
            label: (pointA as any)._label,
          })
        }
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
          label: "Solved Via Margin",
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
