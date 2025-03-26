import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { SimplifiedPcbTrace, SimpleRouteJson } from "lib/types"
import { HighDensityRoute } from "lib/types/high-density-types"
import { LayerName, mapZToLayerName } from "lib/utils/mapZToLayerName"

/**
 * Convert a simplified PCB trace from the autorouter to a circuit-json compatible PCB trace
 */
function convertSimplifiedPcbTraceToCircuitJson(
  simplifiedTrace: SimplifiedPcbTrace,
): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: simplifiedTrace.pcb_trace_id,
    route: simplifiedTrace.route.map((segment) => {
      if (segment.route_type === "wire") {
        return {
          route_type: "wire",
          x: segment.x,
          y: segment.y,
          width: segment.width,
          layer: segment.layer as LayerName,
        }
      } else {
        // via
        return {
          route_type: "via",
          x: segment.x,
          y: segment.y,
          from_layer: segment.from_layer,
          to_layer: segment.to_layer,
        }
      }
    }),
  }
}

/**
 * Convert a high density route from the autorouter to a circuit-json compatible PCB trace
 */
function convertHdRouteToCircuitJson(
  hdRoute: HighDensityRoute,
  id: string,
  width = 0.1,
): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: id,
    route: hdRoute.route.map((point, index) => {
      // For each point in the route, create a wire segment
      return {
        route_type: "wire",
        x: point.x,
        y: point.y,
        width,
        layer: mapZToLayerName(point.z, 2),
      }
    }),
  }
}

/**
 * Convert the autorouter output (SimpleRouteJson or HighDensityRoute[]) to circuit-json format
 */
export function convertToCircuitJson(
  input: SimpleRouteJson | HighDensityRoute[],
  minTraceWidth = 0.1,
): AnyCircuitElement[] {
  const circuitJson: AnyCircuitElement[] = []

  // Handle SimpleRouteJson input
  if ("traces" in input && Array.isArray(input.traces)) {
    // If input has traces, convert them to circuit-json format
    input.traces.forEach((trace) => {
      circuitJson.push(
        convertSimplifiedPcbTraceToCircuitJson(trace) as AnyCircuitElement,
      )
    })
  }
  // Handle HighDensityRoute[] input
  else if (Array.isArray(input)) {
    // If input is an array of HighDensityRoute, convert each route to a circuit-json trace
    input.forEach((route, index) => {
      circuitJson.push(
        convertHdRouteToCircuitJson(
          route,
          `trace_${index}`,
          minTraceWidth,
        ) as AnyCircuitElement,
      )
    })
  }

  return circuitJson
}
