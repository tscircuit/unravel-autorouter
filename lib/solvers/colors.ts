import type { SimpleRouteJson } from "../types"
import { transparentize } from "polished"

export const COLORS = [
  "blue",
  "orange",
  "purple",
  "cyan",
  "magenta",
  "yellowgreen",
  "darkgoldenrod",
  "deeppink",
]

export const getColorMap = (srj: SimpleRouteJson) => {
  const colorMap: Record<string, string> = {}
  for (let i = 0; i < srj.connections.length; i++) {
    const connection = srj.connections[i]
    colorMap[connection.name] =
      `hsl(${(i * 360) / srj.connections.length}, 100%, 50%)`
  }
  return colorMap
}

export const safeTransparentize = (color: string, amount: number) => {
  try {
    return transparentize(amount, color)
  } catch (e) {
    console.error(e)
    return color
  }
}
