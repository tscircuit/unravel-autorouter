import { BaseSolver } from "./BaseSolver"
import type { SimpleRouteJson } from "../types"
import type { GraphicsObject } from "../types/graphics-debug-types"

export class CapacityPathingSolver extends BaseSolver {
  constructor(public srj: SimpleRouteJson) {
    super()
  }

  step() {}

  visualize(): GraphicsObject {
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
  }
}
