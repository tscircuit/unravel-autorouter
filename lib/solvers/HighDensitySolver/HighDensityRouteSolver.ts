import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"
import { safeTransparentize } from "../colors"
import { SingleIntraNodeRouteSolver } from "./SingleIntraNodeRouteSolver"
import { HyperSingleIntraNodeSolver } from "../HyperHighDensitySolver/HyperSingleIntraNodeSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"

export class HighDensityRouteSolver extends BaseSolver {
  unsolvedNodePortPoints: NodeWithPortPoints[]
  routes: HighDensityIntraNodeRoute[]
  colorMap: Record<string, string>

  // Defaults as specified: viaDiameter of 0.6 and traceThickness of 0.15
  readonly defaultViaDiameter = 0.6
  readonly defaultTraceThickness = 0.15

  failedSolvers: (SingleIntraNodeRouteSolver | HyperSingleIntraNodeSolver)[]
  activeSubSolver:
    | SingleIntraNodeRouteSolver
    | HyperSingleIntraNodeSolver
    | null = null

  constructor({
    nodePortPoints,
    colorMap,
  }: {
    nodePortPoints: NodeWithPortPoints[]
    colorMap?: Record<string, string>
  }) {
    super()
    this.unsolvedNodePortPoints = nodePortPoints
    this.colorMap = colorMap ?? {}
    this.routes = []
    this.failedSolvers = []
    this.MAX_ITERATIONS = 100_000
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
      // Split route into segments and check z-level
      for (let i = 0; i < route.route.length - 1; i++) {
        const start = route.route[i]
        const end = route.route[i + 1]
        const color = this.colorMap[route.connectionName]

        graphics.lines!.push({
          points: [
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
          ],
          label: route.connectionName,
          strokeColor: start.z === 0 ? color : safeTransparentize(color, 0.75),
          strokeWidth: route.traceThickness,
          strokeDash: start.z !== 0 ? "10, 5" : undefined,
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
      const connectionGroups: Record<string, { x: number; y: number }[]> = {}
      for (const pt of node.portPoints) {
        if (!connectionGroups[pt.connectionName]) {
          connectionGroups[pt.connectionName] = []
        }
        connectionGroups[pt.connectionName].push({ x: pt.x, y: pt.y })
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
