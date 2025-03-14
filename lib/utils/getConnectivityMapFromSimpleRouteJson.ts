import { SimpleRouteJson } from "lib/types"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"

export const getConnectivityMapFromSimpleRouteJson = (srj: SimpleRouteJson) => {
  const connMap = new ConnectivityMap({})
  for (const connection of srj.connections) {
    for (const point of connection.pointsToConnect) {
      if ("pcb_port_id" in point && point.pcb_port_id) {
        connMap.addConnections([[connection.name, point.pcb_port_id as string]])
      }
    }
  }
  for (const obstacle of srj.obstacles) {
    connMap.addConnections([obstacle.connectedTo])
  }
  return connMap
}
