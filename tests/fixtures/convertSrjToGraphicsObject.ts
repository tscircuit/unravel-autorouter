import { Rect, Line, Circle, Point } from "graphics-debug"
import { SimpleRouteJson } from "../../lib/types/srj-types"
import { getColorMap, safeTransparentize } from "lib/solvers/colors"
import { mapZToLayerName } from "lib/utils/mapZToLayerName"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

export const convertSrjToGraphicsObject = (srj: SimpleRouteJson) => {
  const lines: Line[] = []
  const circles: Circle[] = []
  const points: Point[] = []

  const colorMap: Record<string, string> = getColorMap(srj)
  const layerCount = srj.layerCount ?? 2

  // Add points for each connection's pointsToConnect
  if (srj.connections) {
    for (const connection of srj.connections) {
      for (const point of connection.pointsToConnect) {
        points.push({
          x: point.x,
          y: point.y,
          color: colorMap[connection.name]!,
          layer:
            point.layer ??
            ("z" in point
              ? mapZToLayerName(point.z as number, layerCount)
              : "top"),
          label: `${connection.name} (${point.layer})`,
        })
      }
    }
  }

  // Process each trace
  if (srj.traces) {
    for (const trace of srj.traces) {
      for (let j = 0; j < trace.route.length - 1; j++) {
        const routePoint = trace.route[j]
        const nextRoutePoint = trace.route[j + 1]

        if (routePoint.route_type === "via") {
          // Add a circle for the via
          circles.push({
            center: { x: routePoint.x, y: routePoint.y },
            radius: 0.3, // 0.6 via diameter
            fill: "blue",
            stroke: "none",
            layer: `z${mapLayerNameToZ(routePoint.from_layer, layerCount)},${mapLayerNameToZ(routePoint.to_layer, layerCount)}`,
          })
        } else if (
          routePoint.route_type === "wire" &&
          nextRoutePoint.route_type === "wire" &&
          nextRoutePoint.layer === routePoint.layer
        ) {
          // Create a line between consecutive wire segments on the same layer
          lines.push({
            points: [
              { x: routePoint.x, y: routePoint.y },
              { x: nextRoutePoint.x, y: nextRoutePoint.y },
            ],
            layer: `z${mapLayerNameToZ(routePoint.layer, layerCount)}`,
            strokeWidth: 0.15,
            strokeColor: safeTransparentize(
              {
                top: "red",
                bottom: "blue",
                inner1: "green",
                inner2: "yellow",
              }[routePoint.layer]!,
              0.5,
            ),
            // For some reason this is too small, likely a graphics-debug bug
            // strokeWidth: 0.15,
          })
        }
      }
    }
  }

  return {
    rects: srj.obstacles.map(
      (o) =>
        ({
          center: o.center,
          width: o.width,
          height: o.height,
          fill: "rgba(255,0,0,0.5)",
          layer: `z${o.layers.map(mapLayerNameToZ).join(",")}`,
        }) as Rect,
    ),
    circles,
    lines,
    points,
  }
}
