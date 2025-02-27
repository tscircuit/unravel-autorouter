import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"

export class SingleHighDensityRouteStitchSolver extends BaseSolver {
  remainingHdRoutes: HighDensityIntraNodeRoute[]
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }

  constructor(opts: {
    hdRoutes: HighDensityIntraNodeRoute[]
    start: { x: number; y: number; z: number }
    end: { x: number; y: number; z: number }
  }) {
    super()
    this.remainingHdRoutes = [...opts.hdRoutes]
    this.start = opts.start
    this.end = opts.end
  }

  _step() {}

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      points: [],
      lines: [],
      circles: [],
      title: "Single High Density Route Stitch Solver",
    }

    // Visualize start and end points
    graphics.points?.push(
      {
        x: this.start.x,
        y: this.start.y,
        color: "green",
        label: "Start",
      },
      {
        x: this.end.x,
        y: this.end.y,
        color: "red",
        label: "End",
      }
    )

    // Visualize all HD routes 
    for (const hdRoute of this.remainingHdRoutes) {
      if (hdRoute.route.length > 1) {
        // Create a line for the route
        graphics.lines?.push({
          points: hdRoute.route.map(point => ({ x: point.x, y: point.y })),
          stroke: "blue",
        })
      }

      // Add points for each route node
      for (const point of hdRoute.route) {
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: "blue",
        })
      }

      // Visualize vias
      for (const via of hdRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: hdRoute.viaDiameter / 2,
          fill: "purple",
          stroke: "purple",
        })
      }
    }

    return graphics
  }
}
