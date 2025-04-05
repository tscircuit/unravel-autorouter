import { ObstacleSpatialHashIndex } from "lib/data-structures/ObstacleTree"
import { BaseSolver } from "../BaseSolver"
import {
  HighDensityRoute,
  HighDensityRouteSpatialIndex,
} from "lib/data-structures/HighDensityRouteSpatialIndex"
import { segmentToBoxMinDistance } from "@tscircuit/math-utils"

interface RouteSection {
  startIndex: number
  endIndex: number
  z: number
  pointsInSegment: HighDensityRoute["route"]
}

export class SingleRouteUselessViaRemovalSolver extends BaseSolver {
  obstacleSHI: ObstacleSpatialHashIndex
  hdRouteSHI: HighDensityRouteSpatialIndex
  unsimplifiedRoute: HighDensityRoute

  routeSections: Array<RouteSection>

  currentSectionIndex: number

  TRACE_THICKNESS = 0.15
  OBSTACLE_MARGIN = 0.1

  constructor(params: {
    obstacleSHI: ObstacleSpatialHashIndex
    hdRouteSHI: HighDensityRouteSpatialIndex
    unsimplifiedRoute: HighDensityRoute
  }) {
    super()
    this.currentSectionIndex = 1
    this.obstacleSHI = params.obstacleSHI
    this.hdRouteSHI = params.hdRouteSHI
    this.unsimplifiedRoute = params.unsimplifiedRoute

    this.routeSections = this.breakRouteIntoSections(this.unsimplifiedRoute)
  }

  breakRouteIntoSections(route: HighDensityRoute) {
    const routeSections: this["routeSections"] = []
    const routePoints = route.route
    if (routePoints.length === 0) return []

    let currentSection = {
      startIndex: 0,
      endIndex: -1,
      z: routePoints[0].z,
      pointsInSegment: [routePoints[0]],
    }
    for (let i = 1; i < routePoints.length; i++) {
      if (routePoints[i].z === currentSection.z) {
        currentSection.pointsInSegment.push(routePoints[i])
      } else {
        currentSection.endIndex = i - 1
        currentSection = {
          startIndex: i,
          endIndex: -1,
          z: routePoints[i].z,
          pointsInSegment: [routePoints[i]],
        }
      }
    }

    return routeSections
  }

  _step() {
    // We skip the first/last segment (since it's connected to the destination)
    if (this.currentSectionIndex === this.routeSections.length - 1) {
      this.solved = true
      return
    }

    const prevSection = this.routeSections[this.currentSectionIndex]
    const currentSection = this.routeSections[this.currentSectionIndex]
    const nextSection = this.routeSections[this.currentSectionIndex]

    if (prevSection.z !== nextSection.z) {
      // We only remove vias where there is a middle section that can be
      // replaced by the layer of adjacent sections, if the adjacent sections
      // don't have matching layers, a more complex algo is needed
      this.currentSectionIndex++
      return
    }

    const targetZ = prevSection.z

    if (this.canSectionMoveToLayer({ currentSection, targetZ })) {
      currentSection.z = targetZ
      currentSection.pointsInSegment = currentSection.pointsInSegment.map(
        (p) => ({
          ...p,
          z: targetZ,
        }),
      )
      this.currentSectionIndex += 2
      return
    }

    this.currentSectionIndex++
    return
  }

  canSectionMoveToLayer({
    currentSection,
    targetZ,
  }: {
    currentSection: RouteSection
    targetZ: number
  }): boolean {
    // Evaluate if the section layer can be changed without hitting anything
    for (let i = 0; i < currentSection.pointsInSegment.length - 1; i++) {
      const A = { ...currentSection.pointsInSegment[i], z: targetZ }
      const B = { ...currentSection.pointsInSegment[i + 1], z: targetZ }

      const conflictingRoutes = this.hdRouteSHI.getConflictingRoutesForSegment(
        A,
        B,
        this.TRACE_THICKNESS,
      )

      for (const { conflictingRoute, distance } of conflictingRoutes) {
        if (
          conflictingRoute.connectionName ===
          this.unsimplifiedRoute.connectionName
        )
          continue
        // TODO connMap test
        if (distance < this.TRACE_THICKNESS + conflictingRoute.traceThickness) {
          return false
        }
      }

      const segmentBox = {
        centerX: (A.x + B.x) / 2,
        centerY: (A.y + B.y) / 2,
        width: Math.abs(A.x - B.x),
        height: Math.abs(A.y - B.y),
      }

      // Obstacle check
      const obstacles = this.obstacleSHI.getNodesInArea(
        segmentBox.centerX,
        segmentBox.centerY,
        segmentBox.width,
        segmentBox.height,
      )

      for (const obstacle of obstacles) {
        // TODO connMap test
        const distToObstacle = segmentToBoxMinDistance(A, B, obstacle)

        if (distToObstacle < this.TRACE_THICKNESS + this.OBSTACLE_MARGIN) {
          return false
        }
      }
    }

    return true
  }

  getOptimizedHdRoute(): HighDensityRoute {
    // TODO reconstruct the route from segments, we will need to recompute the
    // vias
    const route = this.routeSections.flatMap(
      (section) => section.pointsInSegment,
    )
    const vias: HighDensityRoute["vias"] = []
    for (let i = 0; i < route.length - 1; i++) {
      if (route[i].z !== route[i + 1].z) {
        vias.push({
          x: route[i].x,
          y: route[i].z,
        })
      }
    }
    return {
      connectionName: this.unsimplifiedRoute.connectionName,
      route,
      traceThickness: this.unsimplifiedRoute.traceThickness,
      vias,
      viaDiameter: this.unsimplifiedRoute.viaDiameter,
    }
  }
}
