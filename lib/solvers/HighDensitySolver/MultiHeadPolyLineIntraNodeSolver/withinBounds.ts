import { MHPoint } from "./types"

export const withinBounds = (
  point: MHPoint,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  padding: number = 0,
) => {
  return (
    point.x >= bounds.minX + padding &&
    point.x <= bounds.maxX - padding &&
    point.y >= bounds.minY + padding &&
    point.y <= bounds.maxY - padding
  )
}
