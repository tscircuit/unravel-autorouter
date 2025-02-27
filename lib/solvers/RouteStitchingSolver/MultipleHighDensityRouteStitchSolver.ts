import { SimpleRouteConnection } from "lib/types"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import { SingleHighDensityRouteStitchSolver } from "./SingleHighDensityRouteStitchSolver"
import { GraphicsObject } from "graphics-debug"
import { safeTransparentize } from "../colors"

export type UnsolvedRoute = {
  connectionName: string
  hdRoutes: HighDensityIntraNodeRoute[]
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
}

export class MultipleHighDensityRouteStitchSolver extends BaseSolver {
  unsolvedRoutes: UnsolvedRoute[]
  activeSolver: SingleHighDensityRouteStitchSolver | null = null
  mergedHdRoutes: HighDensityIntraNodeRoute[] = []

  constructor(opts: {
    connections: SimpleRouteConnection[]
    hdRoutes: HighDensityIntraNodeRoute[]
    layerCount: number
  }) {
    super()
    this.unsolvedRoutes = opts.connections.map((c) => ({
      connectionName: c.name,
      hdRoutes: opts.hdRoutes.filter((r) => r.connectionName === c.name),
      start: {
        ...c.pointsToConnect[0],
        z: mapLayerNameToZ(c.pointsToConnect[0].layer, opts.layerCount),
      },
      end: {
        ...c.pointsToConnect[1],
        z: mapLayerNameToZ(c.pointsToConnect[1].layer, opts.layerCount),
      },
    }))
  }

  _step() {
    if (this.activeSolver) {
      this.activeSolver.step()
      if (this.activeSolver.solved) {
        this.mergedHdRoutes.push(this.activeSolver.mergedHdRoute)
        this.activeSolver = null
      } else if (this.activeSolver.failed) {
        this.failed = true
        this.error = this.activeSolver.error
      }
      return
    }

    const unsolvedRoute = this.unsolvedRoutes.pop()

    if (!unsolvedRoute) {
      this.solved = true
      return
    }

    this.activeSolver = new SingleHighDensityRouteStitchSolver({
      hdRoutes: unsolvedRoute.hdRoutes,
      start: unsolvedRoute.start,
      end: unsolvedRoute.end,
    })
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      points: [],
      lines: [],
      circles: [],
      title: "Multiple High Density Route Stitch Solver",
    }

    // Visualize the active solver if one exists
    if (this.activeSolver) {
      // Combine visualizations from the active solver
      const activeSolverGraphics = this.activeSolver.visualize()

      // Merge points
      if (activeSolverGraphics.points?.length) {
        graphics.points?.push(...activeSolverGraphics.points)
      }

      // Merge lines
      if (activeSolverGraphics.lines?.length) {
        graphics.lines?.push(...activeSolverGraphics.lines)
      }

      // Merge circles
      if (activeSolverGraphics.circles?.length) {
        graphics.circles?.push(...activeSolverGraphics.circles)
      }

      // Merge rects if they exist
      if (activeSolverGraphics.rects?.length) {
        graphics.rects = activeSolverGraphics.rects
      }
    }

    // Visualize all merged HD routes that have been solved
    for (const [i, mergedRoute] of this.mergedHdRoutes.entries()) {
      const solvedColor = `hsl(120, 100%, ${40 + ((i * 10) % 40)}%)` // Different shades of green

      // Visualize the route path
      if (mergedRoute.route.length > 1) {
        graphics.lines?.push({
          points: mergedRoute.route.map((point) => ({
            x: point.x,
            y: point.y,
          })),
          strokeColor: solvedColor,
          strokeWidth: mergedRoute.traceThickness,
        })
      }

      // Visualize route points
      for (const point of mergedRoute.route) {
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: solvedColor,
        })
      }

      // Visualize vias in the merged route
      for (const via of mergedRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: mergedRoute.viaDiameter / 2,
          fill: solvedColor,
        })
      }
    }

    // Visualize all remaining unsolved routes - start/end points only
    const colorList = Array.from(
      { length: this.unsolvedRoutes.length },
      (_, i) => `hsl(${(i * 360) / this.unsolvedRoutes.length}, 100%, 50%)`,
    )
    for (const [i, unsolvedRoute] of this.unsolvedRoutes.entries()) {
      // Add start and end points for unsolved connections
      graphics.points?.push(
        {
          x: unsolvedRoute.start.x,
          y: unsolvedRoute.start.y,
          color: colorList[i],
          label: `${unsolvedRoute.connectionName} Start`,
        },
        {
          x: unsolvedRoute.end.x,
          y: unsolvedRoute.end.y,
          color: colorList[i],
          label: `${unsolvedRoute.connectionName} End`,
        },
      )

      // Add a light dashed line between start and end to show pending connections
      graphics.lines?.push({
        points: [
          { x: unsolvedRoute.start.x, y: unsolvedRoute.start.y },
          { x: unsolvedRoute.end.x, y: unsolvedRoute.end.y },
        ],
        strokeColor: colorList[i],
        strokeDash: "2 2",
      })

      // Visualize HD routes associated with unsolved routes (faded)
      for (const hdRoute of unsolvedRoute.hdRoutes) {
        if (hdRoute.route.length > 1) {
          graphics.lines?.push({
            points: hdRoute.route.map((point) => ({ x: point.x, y: point.y })),
            strokeColor: safeTransparentize(colorList[i], 0.5),
            strokeDash: "10 5",
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
    }

    return graphics
  }
}
