import { SimplifiedPcbTraces } from "lib/types"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

type Point = { x: number; y: number; z: number }

export const convertHdRouteToSimplifiedRoute = (
  hdRoute: HighDensityIntraNodeRoute,
): SimplifiedPcbTraces[number]["route"] => {
  // Group points by z-level to create segments
  const segmentsByZ: Record<number, Point[]> = {}

  // Populate segments by z-level
  for (const point of hdRoute.route) {
    if (!segmentsByZ[point.z]) {
      segmentsByZ[point.z] = []
    }
    segmentsByZ[point.z].push(point)
  }

  // Convert to simplified route format
  const result: SimplifiedPcbTraces[number]["route"] = []

  // Process each z-level segment
  Object.entries(segmentsByZ).forEach(([z, points]) => {
    const layerName = z === "0" ? "top" : z === "1" ? "bottom" : `inner${z}`

    // Add wire segments for this z-level
    for (const point of points) {
      result.push({
        route_type: "wire",
        x: point.x,
        y: point.y,
        width: hdRoute.traceThickness,
        layer: layerName,
      })
    }
  })

  // Add vias where z-level changes
  for (let i = 0; i < hdRoute.route.length - 1; i++) {
    const current = hdRoute.route[i]
    const next = hdRoute.route[i + 1]

    // If z changes, add a via
    if (current.z !== next.z) {
      const fromLayer =
        current.z === 0
          ? "top"
          : current.z === 1
            ? "bottom"
            : `inner${current.z}`
      const toLayer =
        next.z === 0 ? "top" : next.z === 1 ? "bottom" : `inner${next.z}`

      // Check if this via position is in the vias array
      const viaExists = hdRoute.vias.some(
        (via) =>
          Math.abs(via.x - next.x) < 0.001 && Math.abs(via.y - next.y) < 0.001,
      )

      if (viaExists) {
        result.push({
          route_type: "via",
          x: next.x,
          y: next.y,
          from_layer: fromLayer,
          to_layer: toLayer,
        })
      }
    }
  }

  return result
}
