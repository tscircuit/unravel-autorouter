import type { GraphicsObject } from "graphics-debug"
import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"
import { safeTransparentize } from "../colors"
import { SingleHighDensityRouteSolver2_CenterAttraction } from "./SingleHighDensityRouteSolver2_CenterAttraction"
import { SingleHighDensityRouteSolver3_RepelEndpoints } from "./SingleHighDensityRouteSolver3_RepellingEndpoints"
import { SingleHighDensityRouteSolver4_RepelEdgeViaFuture } from "./SingleHighDensityRouteSolver4_RepelEdgeViaFuture"
import { SingleHighDensityRouteSolver5_BinaryFutureConnectionPenalty } from "./SingleHighDensityRouteSolver5_BinaryFutureConnectionPenalty"
import { SingleHighDensityRouteSolver6_VertHorzLayer_FutureCost } from "./SingleHighDensityRouteSolver6_VertHorzLayer_FutureCost"

export class SingleIntraNodeRouteSolver extends BaseSolver {
  nodeWithPortPoints: NodeWithPortPoints
  colorMap: Record<string, string>
  unsolvedConnections: {
    connectionName: string
    points: { x: number; y: number }[]
  }[]

  solvedRoutes: HighDensityIntraNodeRoute[]
  failedSolvers: SingleHighDensityRouteSolver[]

  constructor(params: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
  }) {
    const { nodeWithPortPoints, colorMap } = params
    super()
    this.nodeWithPortPoints = nodeWithPortPoints
    this.colorMap = colorMap ?? {}
    this.solvedRoutes = []
    this.failedSolvers = []
    const unsolvedConnectionsMap: Map<string, { x: number; y: number }[]> =
      new Map()
    for (const { connectionName, x, y } of nodeWithPortPoints.portPoints) {
      unsolvedConnectionsMap.set(connectionName, [
        ...(unsolvedConnectionsMap.get(connectionName) ?? []),
        { x, y },
      ])
    }
    this.unsolvedConnections = Array.from(
      unsolvedConnectionsMap.entries().map(([connectionName, points]) => ({
        connectionName,
        points,
      })),
    )
  }

  step() {
    const unsolvedConnection = this.unsolvedConnections.pop()
    if (!unsolvedConnection) {
      this.solved = true
      return
    }
    const { connectionName, points } = unsolvedConnection
    const solver = new SingleHighDensityRouteSolver6_VertHorzLayer_FutureCost({
      connectionName,
      node: this.nodeWithPortPoints,
      A: { x: points[0].x, y: points[0].y, z: 0 },
      B: {
        x: points[points.length - 1].x,
        y: points[points.length - 1].y,
        z: 0,
      },
      obstacleRoutes: this.solvedRoutes,
      futureConnections: this.unsolvedConnections,
      layerCount: 2,
    })
    solver.solve()
    if (solver.solvedPath) {
      this.solvedRoutes.push(solver.solvedPath)
    } else {
      this.failedSolvers.push(solver)
    }
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Visualize input nodeWithPortPoints
    for (const pt of this.nodeWithPortPoints.portPoints) {
      graphics.points!.push({
        x: pt.x,
        y: pt.y,
        label: pt.connectionName,
        color: this.colorMap[pt.connectionName] ?? "blue",
      })
    }

    // Visualize solvedRoutes
    for (const route of this.solvedRoutes) {
      if (route.route.length > 0) {
        const routeColor = this.colorMap[route.connectionName] ?? "blue"

        // Draw route segments between points
        for (let i = 0; i < route.route.length - 1; i++) {
          const p1 = route.route[i]
          const p2 = route.route[i + 1]

          graphics.lines!.push({
            points: [p1, p2],
            strokeColor:
              p1.z === 0
                ? safeTransparentize(routeColor, 0.2)
                : safeTransparentize(routeColor, 0.8),
            layer: `route-layer-${p1.z}`,
            strokeWidth: route.traceThickness,
          })
        }

        // Draw vias
        for (const via of route.vias) {
          graphics.circles!.push({
            center: { x: via.x, y: via.y },
            radius: route.viaDiameter / 2,
            fill: safeTransparentize(routeColor, 0.5),
            layer: "via",
          })
        }
      }
    }

    return graphics
  }
}
