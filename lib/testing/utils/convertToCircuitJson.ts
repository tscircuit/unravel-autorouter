import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { SimplifiedPcbTrace, SimpleRouteJson } from "lib/types"
import { HighDensityRoute } from "lib/types/high-density-types"
import { LayerName, mapZToLayerName } from "lib/utils/mapZToLayerName"

/**
 * Convert a simplified PCB trace from the autorouter to a circuit-json compatible PCB trace
 */
function convertSimplifiedPcbTraceToCircuitJson(
  simplifiedTrace: SimplifiedPcbTrace,
  connectionName: string,
): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: simplifiedTrace.pcb_trace_id,
    source_trace_id: connectionName,
    route: simplifiedTrace.route.map((segment) => {
      if (segment.route_type === "wire") {
        return {
          route_type: "wire",
          x: segment.x,
          y: segment.y,
          width: segment.width,
          layer: segment.layer as LayerName,
          start_pcb_port_id: (segment as any).start_pcb_port_id,
          end_pcb_port_id: (segment as any).end_pcb_port_id,
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
  connectionName: string,
  width = 0.1,
): PcbTrace {
  // Try to identify port connections at start and end points
  const firstPoint = hdRoute.route[0]
  const lastPoint = hdRoute.route[hdRoute.route.length - 1]

  return {
    type: "pcb_trace",
    pcb_trace_id: id,
    source_trace_id: connectionName,
    route: hdRoute.route.map((point, index) => {
      const isFirstPoint = index === 0
      const isLastPoint = index === hdRoute.route.length - 1

      // For each point in the route, create a wire segment
      return {
        route_type: "wire",
        x: point.x,
        y: point.y,
        width,
        layer: mapZToLayerName(point.z, 2),
        // Add port connection if this is first or last point and has port info
        ...(isFirstPoint && (point as any).pcb_port_id
          ? { start_pcb_port_id: (point as any).pcb_port_id }
          : {}),
        ...(isLastPoint && (point as any).pcb_port_id
          ? { end_pcb_port_id: (point as any).pcb_port_id }
          : {}),
      }
    }),
  }
}

/**
 * Create source_trace elements from the SimpleRouteJson connections
 * These represent the logical connections between points
 */
function createSourceTraces(srj: SimpleRouteJson): AnyCircuitElement[] {
  const sourceTraces: AnyCircuitElement[] = []

  // Process each connection to create a source_trace
  srj.connections.forEach((connection) => {
    // Extract port IDs from the connection points
    const connectedPortIds = connection.pointsToConnect
      .filter((point) => point.pcb_port_id)
      .map((point) => point.pcb_port_id!)
      .filter(Boolean)

    // Look for original connection name (might be MST-suffixed by NetToPointPairsSolver)
    const baseName = connection.name.replace(/_mst\d+$/, "")
    const netConnectionName = connection.netConnectionName || baseName

    // Check if this source_trace already exists
    const existingSourceTrace = sourceTraces.find(
      (st) =>
        st.type === "source_trace" && st.source_trace_id === netConnectionName,
    )

    if (existingSourceTrace) {
      // Add these port IDs to the existing source_trace
      const sourceTrace = existingSourceTrace as any
      sourceTrace.connected_source_port_ids = [
        ...new Set([
          ...sourceTrace.connected_source_port_ids,
          ...connectedPortIds,
        ]),
      ]
    } else {
      // Create a new source_trace for this connection
      sourceTraces.push({
        type: "source_trace",
        source_trace_id: netConnectionName,
        connected_source_port_ids: connectedPortIds,
        connected_source_net_ids: [],
      })
    }
  })

  return sourceTraces
}

/**
 * Create circuit-json pcb_port elements for the connection points
 */
function createPcbPorts(srj: SimpleRouteJson): AnyCircuitElement[] {
  const portMap = new Map<string, any>()

  srj.connections.forEach((connection) => {
    connection.pointsToConnect.forEach((point) => {
      if (point.pcb_port_id) {
        portMap.set(point.pcb_port_id, {
          type: "pcb_port",
          pcb_port_id: point.pcb_port_id,
          source_port_id: point.pcb_port_id, // Assuming same ID for simplicity
          x: point.x,
          y: point.y,
          layers: [point.layer],
        })
      }
    })
  })

  return Array.from(portMap.values())
}

/**
 * Convert the autorouter output to circuit-json format
 * @param srjWithPointPairs The SimpleRouteJson created by the NetToPointPairsSolver
 * @param routes The SimplifiedPcbTraces or HighDensityRoutes to convert
 * @param minTraceWidth Default width for traces if not specified
 */
export function convertToCircuitJson(
  srjWithPointPairs: SimpleRouteJson,
  routes: SimplifiedPcbTrace[] | HighDensityRoute[],
  minTraceWidth = 0.1,
): AnyCircuitElement[] {
  // Start with empty circuit JSON
  const circuitJson: AnyCircuitElement[] = []

  // Add source traces from connection information
  circuitJson.push(...createSourceTraces(srjWithPointPairs))

  // Add PCB ports for connection points
  circuitJson.push(...createPcbPorts(srjWithPointPairs))

  // Build a map of connection names to simplify lookups
  const connectionMap = new Map<string, string>()
  srjWithPointPairs.connections.forEach((conn) => {
    const baseName = conn.name.replace(/_mst\d+$/, "")
    connectionMap.set(conn.name, conn.netConnectionName || baseName)
  })

  // Process routes based on their type
  if (routes.length > 0) {
    if ("type" in routes[0] && routes[0].type === "pcb_trace") {
      // Handle SimplifiedPcbTraces
      ;(routes as SimplifiedPcbTrace[]).forEach((trace) => {
        const connectionName = trace.connection_name
        circuitJson.push(
          convertSimplifiedPcbTraceToCircuitJson(
            trace,
            connectionMap.get(connectionName) || connectionName,
          ) as AnyCircuitElement,
        )
      })
    } else {
      // Handle HighDensityRoutes
      ;(routes as HighDensityRoute[]).forEach((route, index) => {
        const connectionName = route.connectionName
        circuitJson.push(
          convertHdRouteToCircuitJson(
            route,
            `trace_${index}`,
            connectionMap.get(connectionName) || connectionName,
            minTraceWidth,
          ) as AnyCircuitElement,
        )
      })
    }
  }

  return circuitJson
}
