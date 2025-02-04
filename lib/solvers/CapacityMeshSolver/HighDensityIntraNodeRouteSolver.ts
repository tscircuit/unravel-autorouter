import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver"

export class HighDensityIntraNodeRouteSolver extends BaseSolver {
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
   *
   * When finding routes, we look at each point in the node with the same
   * connection name, and try to connect it directly with a straight line
   * starting at z=0 (all routes start at z=0)
   *
   * If we intersect any of the other routes within the node that have already
   * been laid down, we attempt to find a place to put a via.
   *
   * We can find a place to place a via by looking at the intersection point
   * and explore both sides of the intersection with a grid solver.
   *
   * When we find a suitable place for the via (where there is enough room for
   * a via of size defaultViaDiameter), we place the via and attempt to solve
   * between the two vias we placed.
   */
  step() {}

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
    for (const route of this.routes) {
      graphics.lines.push({
        points: route.route.map((pt) => ({ x: pt.x, y: pt.y })),
        label: route.connectionName,
        fill,
      })
      for (const via of route.vias) {
        graphics.circles.push({
          center: via,
          radius: route.viaDiameter / 2,
          fill: this.colorMap[route.connectionName],
          label: `${route.connectionName} via`,
        })
      }
    }
    return graphics
  }
}
