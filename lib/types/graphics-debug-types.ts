export interface GraphicsObject {
  points?: { x: number; y: number; color?: string; label?: string }[]
  lines?: { points: { x: number; y: number; stroke?: number }[] }[]
  rects?: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    fill?: string
    stroke?: string
  }>
  circles?: Array<{
    center: { x: number; y: number }
    radius: number
    fill?: string
    stroke?: string
  }>
  grid?: { cellSize: number; label?: boolean }
  coordinateSystem?: "cartesian" | "screen"
  title?: string
}
