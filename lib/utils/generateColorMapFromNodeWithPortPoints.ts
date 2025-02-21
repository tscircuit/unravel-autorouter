import { NodeWithPortPoints } from "lib/types/high-density-types"

export const generateColorMapFromNodeWithPortPoints = (
  nodeWithPortPoints: NodeWithPortPoints,
) => {
  const colorMap: Record<string, string> = {}
  nodeWithPortPoints.portPoints.forEach((portPoint, i) => {
    colorMap[portPoint.connectionName] =
      `hsl(${(i * 360) / nodeWithPortPoints.portPoints.length}, 100%, 50%)`
  })
  return colorMap
}
