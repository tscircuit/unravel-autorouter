import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"
import { safeTransparentize } from "../colors"
import { IntraNodeRouteSolver } from "./IntraNodeSolver"
import { HyperSingleIntraNodeSolver } from "../HyperHighDensitySolver/HyperSingleIntraNodeSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { mergeRouteSegments } from "lib/utils/mergeRouteSegments"

export class HighDensitySolver extends BaseSolver {
  unsolvedNodePortPoints: NodeWithPortPoints[]
  routes: HighDensityIntraNodeRoute[]
  colorMap: Record<string, string>

  // Defaults as specified: viaDiameter of 0.6 and traceThickness of 0.15
  readonly defaultViaDiameter = 0.6
  readonly defaultTraceThickness = 0.15

  failedSolvers: (IntraNodeRouteSolver | HyperSingleIntraNodeSolver)[]
  activeSubSolver: IntraNodeRouteSolver | HyperSingleIntraNodeSolver | null =
    null
  connMap?: ConnectivityMap

  constructor({
    nodePortPoints,
    colorMap,
    connMap,
  }: {
    nodePortPoints: NodeWithPortPoints[]
    colorMap?: Record<string, string>
    connMap?: ConnectivityMap
  }) {
    super()
    this.unsolvedNodePortPoints = nodePortPoints
    this.colorMap = colorMap ?? {}
    this.connMap = connMap
    this.routes = []
    this.failedSolvers = []
    this.MAX_ITERATIONS = 1e6
  }

  /**
   * Each iteration, pop an unsolved node and attempt to find the routes inside
   * of it.
   */
  _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        this.routes.push(...this.activeSubSolver.solvedRoutes)
        this.activeSubSolver = null
      } else if (this.activeSubSolver.failed) {
        this.failedSolvers.push(this.activeSubSolver)
        this.activeSubSolver = null
      }
      return
    }
    if (this.unsolvedNodePortPoints.length === 0) {
      this.solved = true
      return
    }
    const node = this.unsolvedNodePortPoints.pop()!

    this.activeSubSolver = new HyperSingleIntraNodeSolver({
      nodeWithPortPoints: node,
      colorMap: this.colorMap,
      connMap: this.connMap,
    })
  }

  visualize(): GraphicsObject {
    let graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
    for (const route of this.routes) {
      // Merge segments based on z-coordinate
      const mergedSegments = mergeRouteSegments(
        route.route,
        route.connectionName,
        this.colorMap[route.connectionName],
      )

      // Add merged segments to graphics
      for (const segment of mergedSegments) {
        graphics.lines!.push({
          points: segment.points,
          label: segment.connectionName,
          strokeColor:
            segment.z === 0
              ? segment.color
              : safeTransparentize(segment.color, 0.75),
          strokeWidth: route.traceThickness,
          strokeDash: segment.z !== 0 ? "10, 5" : undefined,
        })
      }
      for (const via of route.vias) {
        graphics.circles!.push({
          center: via,
          radius: route.viaDiameter / 2,
          fill: this.colorMap[route.connectionName],
          label: `${route.connectionName} via`,
        })
      }
    }
    for (const solver of this.failedSolvers) {
      const node = solver.nodeWithPortPoints
      // Group port points by connectionName
      const connectionGroups: Record<
        string,
        { x: number; y: number; z: number }[]
      > = {}
      for (const pt of node.portPoints) {
        if (!connectionGroups[pt.connectionName]) {
          connectionGroups[pt.connectionName] = []
        }
        connectionGroups[pt.connectionName].push({ x: pt.x, y: pt.y, z: pt.z })
      }

      for (const [connectionName, points] of Object.entries(connectionGroups)) {
        for (let i = 0; i < points.length - 1; i++) {
          const start = points[i]
          const end = points[i + 1]
          graphics.lines!.push({
            points: [start, end],
            strokeColor: "red",
            strokeDash: "10, 5",
          })
        }
      }
    }
    if (this.activeSubSolver) {
      graphics = combineVisualizations(
        graphics,
        this.activeSubSolver.visualize(),
      )
    }
    return graphics
  }
}
