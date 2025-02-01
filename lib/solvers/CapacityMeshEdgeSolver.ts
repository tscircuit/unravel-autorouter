import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"
import { BaseSolver } from "./BaseSolver"

export class CapacityMeshEdgeSolver extends BaseSolver {
  constructor(public nodes: CapacityMeshNode[]) {
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
