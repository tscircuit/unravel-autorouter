import { Rect, Line, Circle } from "graphics-debug"
import { SimpleRouteJson } from "../../lib/types/srj-types"
import { safeTransparentize } from "lib/solvers/colors"

export const convertSrjToGraphicsObject = (srj: SimpleRouteJson) => {
  const lines: Line[] = []
  const circles: Circle[] = []
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
            fill: "rgba(0,0,255,0.5)",
            stroke: "none",
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
            strokeColor: safeTransparentize(
              {
                top: "red",
                bottom: "blue",
                inner1: "green",
                inner2: "yellow",
              }[routePoint.layer]!,
              0.5,
            ),
            strokeWidth: 0.15,
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
        }) as Rect,
    ),
    circles,
    lines,
  }
}
