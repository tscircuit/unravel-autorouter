import type { GraphicsObject } from "graphics-debug"

export const combineVisualizations = (
  ...visualizations: GraphicsObject[]
): GraphicsObject => {
  const combined = {
    points: [],
    lines: [],
    circles: [],
    rects: [],
  }

  for (let i = 0; i < visualizations.length; i++) {
    // TODO
  }

  return combined
}
