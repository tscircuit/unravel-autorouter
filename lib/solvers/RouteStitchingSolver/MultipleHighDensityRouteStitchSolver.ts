import { SimpleRouteConnection } from "lib/types"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import { SingleHighDensityRouteStitchSolver } from "./SingleHighDensityRouteStitchSolver"
import { GraphicsObject } from "graphics-debug"

export type UnsolvedRoute = {
  connectionName: string
  hdRoutes: HighDensityIntraNodeRoute[]
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
}

export class MultipleHighDensityRouteStitchSolver extends BaseSolver {
  unsolvedRoutes: UnsolvedRoute[]
  activeSolver: SingleHighDensityRouteStitchSolver | null = null

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

  // visualize(): GraphicsObject {

  // }
}
