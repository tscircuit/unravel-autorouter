import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import { distance } from "@tscircuit/math-utils"

export class SingleHighDensityRouteStitchSolver extends BaseSolver {
  mergedHdRoute: HighDensityIntraNodeRoute
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
    this.mergedHdRoute = {
      connectionName: opts.hdRoutes[0].connectionName,
      route: [
        {
          x: opts.start.x,
          y: opts.start.y,
          z: opts.start.z,
        },
      ],
      vias: [],
      viaDiameter: opts.hdRoutes[0].viaDiameter,
      traceThickness: opts.hdRoutes[0].traceThickness,
    }
    this.start = opts.start
    this.end = opts.end
  }

  _step() {
    if (this.remainingHdRoutes.length === 0) {
      // Add the end point to the merged route
      this.mergedHdRoute.route.push({
        x: this.end.x,
        y: this.end.y,
        z: this.end.z,
      })
      this.solved = true
      return
    }

    const lastMergedPoint =
      this.mergedHdRoute.route[this.mergedHdRoute.route.length - 1]

    // Find the next logical route to merge
    // 1. We need to check both the first and last points of the remaining routes
    // 2. If the last point is closest, we need to reverse the hd route before merging
    // 3. After merging, we remove it from the remaining routes

    let closestRouteIndex = 0
    let matchedOn: "first" | "last" = "first"
    let closestDistance = Infinity
    for (let i = 0; i < this.remainingHdRoutes.length; i++) {
      const hdRoute = this.remainingHdRoutes[i]
      const lastPointInCandidate = hdRoute.route[hdRoute.route.length - 1]
      const firstPointInCandidate = hdRoute.route[0]
      const distToFirst = distance(lastMergedPoint, firstPointInCandidate)
      if (distToFirst < closestDistance) {
        closestDistance = distToFirst
        closestRouteIndex = i
        matchedOn = "first"
      }
      const distToLast = distance(lastMergedPoint, lastPointInCandidate)
      if (distToLast < closestDistance) {
        closestDistance = distToLast
        closestRouteIndex = i
        matchedOn = "last"
      }
    }

    const hdRouteToMerge = this.remainingHdRoutes[closestRouteIndex]
    this.remainingHdRoutes.splice(closestRouteIndex, 1)

    if (matchedOn === "first") {
      this.mergedHdRoute.route.push(...hdRouteToMerge.route)
    } else {
      this.mergedHdRoute.route.push(...hdRouteToMerge.route.reverse())
    }

    this.mergedHdRoute.vias.push(...hdRouteToMerge.vias)
  }

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
      },
    )

    // Visualize the merged HD route in green
    if (this.mergedHdRoute && this.mergedHdRoute.route.length > 1) {
      graphics.lines?.push({
        points: this.mergedHdRoute.route.map((point) => ({
          x: point.x,
          y: point.y,
        })),
        strokeColor: "green",
      })

      // Add points for the merged route
      for (const point of this.mergedHdRoute.route) {
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: "green",
        })
      }

      // Visualize vias in the merged route
      for (const via of this.mergedHdRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: this.mergedHdRoute.viaDiameter / 2,
          fill: "green",
        })
      }
    }

    // Visualize all remaining HD routes
    const colorList = Array.from(
      { length: this.remainingHdRoutes.length },
      (_, i) => `hsl(${(i * 360) / this.remainingHdRoutes.length}, 100%, 50%)`,
    )
    for (const [i, hdRoute] of this.remainingHdRoutes.entries()) {
      if (hdRoute.route.length > 1) {
        // Create a line for the route
        graphics.lines?.push({
          points: hdRoute.route.map((point) => ({ x: point.x, y: point.y })),
          strokeColor: colorList[i],
        })
      }

      // Add points for each route node
      for (const point of hdRoute.route) {
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: colorList[i],
        })
      }

      // Visualize vias
      for (const via of hdRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: hdRoute.viaDiameter / 2,
          fill: colorList[i],
        })
      }
    }

    return graphics
  }
}
