import type { GraphicsObject } from "graphics-debug"
import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "../../types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { SingleHighDensityRouteSolver } from "./SingleHighDensityRouteSolver"

export class SingleIntraNodeRouteSolver extends BaseSolver {
  nodeWithPortPoints: NodeWithPortPoints
  colorMap: Record<string, string>
  unsolvedConnections: {
    connectionName: string
    points: { x: number; y: number }[]
  }[]

  solvedRoutes: HighDensityIntraNodeRoute[]

  constructor({
    nodeWithPortPoints,
    colorMap,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
  }) {
    super()
    this.nodeWithPortPoints = nodeWithPortPoints
    this.colorMap = colorMap ?? {}
    this.solvedRoutes = []
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
    const solver = new SingleHighDensityRouteSolver({
      connectionName,
      A: { x: points[0].x, y: points[0].y, z: 0 },
      B: {
        x: points[points.length - 1].x,
        y: points[points.length - 1].y,
        z: 0,
      },
      obstacleRoutes: this.solvedRoutes,
      layerCount: 2,
    })
    solver.solve()
    if (solver.solvedPath) {
      this.solvedRoutes.push(solver.solvedPath)
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
        graphics.lines!.push({
          points: route.route.map((p) => ({ x: p.x, y: p.y })),
          strokeColor: "green",
          layer: "route",
          strokeWidth: 0.15,
        })
        for (const via of route.vias) {
          graphics.circles!.push({
            center: { x: via.x, y: via.y },
            radius: route.viaDiameter,
            fill: "red",
            layer: "via",
          })
        }
      }
    }

    return graphics
  }
}
