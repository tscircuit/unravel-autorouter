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
import { HighDensityHyperParameters } from "./HighDensityHyperParameters"
import { cloneAndShuffleArray } from "lib/utils/cloneAndShuffleArray"

export class SingleIntraNodeRouteSolver extends BaseSolver {
  nodeWithPortPoints: NodeWithPortPoints
  colorMap: Record<string, string>
  unsolvedConnections: {
    connectionName: string
    points: { x: number; y: number }[]
  }[]

  solvedRoutes: HighDensityIntraNodeRoute[]
  failedSolvers: SingleHighDensityRouteSolver[]
  hyperParameters: Partial<HighDensityHyperParameters>

  activeSolver: SingleHighDensityRouteSolver | null = null

  constructor(params: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
    hyperParameters?: Partial<HighDensityHyperParameters>
  }) {
    const { nodeWithPortPoints, colorMap } = params
    super()
    this.nodeWithPortPoints = nodeWithPortPoints
    this.colorMap = colorMap ?? {}
    this.solvedRoutes = []
    this.hyperParameters = params.hyperParameters ?? {}
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
    this.unsolvedConnections = cloneAndShuffleArray(
      this.unsolvedConnections,
      this.hyperParameters.SHUFFLE_SEED ?? 0,
    )
  }

  step() {
    this.iterations++
    const unsolvedConnection = this.unsolvedConnections.pop()
    this.progress =
      this.unsolvedConnections.length /
      (this.unsolvedConnections.length + this.solvedRoutes.length)
    if (!unsolvedConnection) {
      this.solved = this.failedSolvers.length === 0
      return
    }
    const { connectionName, points } = unsolvedConnection
    this.activeSolver =
      new SingleHighDensityRouteSolver6_VertHorzLayer_FutureCost({
        connectionName,
        bounds: getBoundsFromNodeWithPortPoints(this.nodeWithPortPoints),
        A: { x: points[0].x, y: points[0].y, z: 0 },
        B: {
          x: points[points.length - 1].x,
          y: points[points.length - 1].y,
          z: 0,
        },
        obstacleRoutes: this.solvedRoutes,
        futureConnections: this.unsolvedConnections,
        layerCount: 2,
        hyperParameters: this.hyperParameters,
      })
    this.activeSolver.solve()
    if (this.activeSolver.solvedPath) {
      this.solvedRoutes.push(this.activeSolver.solvedPath)
    } else {
      this.failedSolvers.push(this.activeSolver)
    }
    this.activeSolver = null
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Draw node bounds
    // graphics.rects!.push({
    //   center: {
    //     x: this.nodeWithPortPoints.center.x,
    //     y: this.nodeWithPortPoints.center.y,
    //   },
    //   width: this.nodeWithPortPoints.width,
    //   height: this.nodeWithPortPoints.height,
    //   stroke: "gray",
    //   fill: "transparent",
    // })

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
    for (
      let routeIndex = 0;
      routeIndex < this.solvedRoutes.length;
      routeIndex++
    ) {
      const route = this.solvedRoutes[routeIndex]
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
            step: routeIndex,
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
            step: routeIndex,
          })
        }
      }
    }

    return graphics
  }
}

function getBoundsFromNodeWithPortPoints(
  nodeWithPortPoints: NodeWithPortPoints,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const bounds = {
    minX: nodeWithPortPoints.center.x - nodeWithPortPoints.width / 2,
    maxX: nodeWithPortPoints.center.x + nodeWithPortPoints.width / 2,
    minY: nodeWithPortPoints.center.y - nodeWithPortPoints.height / 2,
    maxY: nodeWithPortPoints.center.y + nodeWithPortPoints.height / 2,
  }

  // Sometimes port points may be outside the node- this happens when there's
  // a "leap" to the final target or at the end or beginning of a trace when
  // we're wrapping up
  for (const pt of nodeWithPortPoints.portPoints) {
    if (pt.x < bounds.minX) {
      bounds.minX = pt.x
    }
    if (pt.x > bounds.maxX) {
      bounds.maxX = pt.x
    }
    if (pt.y < bounds.minY) {
      bounds.minY = pt.y
    }
    if (pt.y > bounds.maxY) {
      bounds.maxY = pt.y
    }
  }

  return bounds
}
