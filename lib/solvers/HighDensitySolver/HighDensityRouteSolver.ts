import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"
import { safeTransparentize } from "../colors"
import { SingleIntraNodeRouteSolver } from "./SingleIntraNodeRouteSolver"

export class HighDensityRouteSolver extends BaseSolver {
  unsolvedNodePortPoints: NodeWithPortPoints[]
  routes: HighDensityIntraNodeRoute[]
  colorMap: Record<string, string>

  // Defaults as specified: viaDiameter of 0.6 and traceThickness of 0.15
  readonly defaultViaDiameter = 0.6
  readonly defaultTraceThickness = 0.15

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
  }

  /**
   * Each iteration, pop an unsolved node and attempt to find the routes inside
   * of it.
   */
  step() {
    if (this.unsolvedNodePortPoints.length === 0) {
      this.solved = true
      return
    }
    const node = this.unsolvedNodePortPoints.pop()!
    // Group port points by connectionName
    const connectionGroups: Record<string, { x: number; y: number }[]> = {}
    for (const pt of node.portPoints) {
      if (!connectionGroups[pt.connectionName]) {
        connectionGroups[pt.connectionName] = []
      }
      connectionGroups[pt.connectionName].push({ x: pt.x, y: pt.y })
    }

    const solver = new SingleIntraNodeRouteSolver({
      nodeWithPortPoints: node,
      colorMap: this.colorMap,
    })
    solver.solve()
    this.routes.push(...solver.solvedRoutes)
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
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
          strokeColor: start.z === 0 ? color : safeTransparentize(color, 0.5),
        })
      }
      for (const via of route.vias) {
        graphics.points!.push({
          // center: via,
          x: via.x,
          y: via.y,
          radius: route.viaDiameter / 2,
          fill: this.colorMap[route.connectionName],
          label: `${route.connectionName} via`,
        })
      }
    }
    return graphics
  }
}
