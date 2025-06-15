import { SimpleRouteJson } from "lib/types"
import { NodeWithPortPoints } from "lib/types/high-density-types"

export function createSrjFromNodeWithPortPoints(
  node: NodeWithPortPoints,
): SimpleRouteJson {
  const { center, width, height } = node
  return {
    layerCount: 2,
    minTraceWidth: 0.1,
    obstacles: [], // NodeWithPortPoints has no obstacles
    connections: [
      // TODO
    ],
    bounds: {
      minX: center.x - width / 2,
      maxX: center.x + width / 2,
      minY: center.y - height / 2,
      maxY: center.y + height / 2,
    },
  }
}
