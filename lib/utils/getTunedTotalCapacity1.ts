import { CapacityMeshNode } from "lib/types/capacity-mesh-types"

export const getTunedTotalCapacity1 = (
  node: CapacityMeshNode,
  maxCapacityFactor = 1,
) => {
  const VIA_DIAMETER = 0.6
  const TRACE_WIDTH = 0.15

  const obstacleMargin = 0.2
  const viaLengthAcross = node.width / (VIA_DIAMETER / 2 + obstacleMargin)

  return (viaLengthAcross / 2) ** 1.1 * maxCapacityFactor
}
