import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../types"
import { BaseSolver } from "./BaseSolver"
import { CapacityMeshEdgeSolver } from "./CapacityMeshEdgeSolver"
import { CapacityMeshNodeSolver } from "./CapacityMeshNodeSolver"

export class CapacityMeshSolver extends BaseSolver {
  nodeSolver: CapacityMeshNodeSolver
  edgeSolver?: CapacityMeshEdgeSolver

  constructor(public srj: SimpleRouteJson) {
    super()
    this.nodeSolver = new CapacityMeshNodeSolver(srj)
  }

  step() {
    if (!this.nodeSolver.solved) {
      this.nodeSolver.solve()
      return
    }
    this.edgeSolver = new CapacityMeshEdgeSolver(this.nodeSolver.finishedNodes)
    this.solved = true
  }

  visualize(): GraphicsObject {
    const nodeViz = this.nodeSolver.visualize()
    const edgeViz = this.edgeSolver?.visualize()

    return {
      lines: [
        ...(nodeViz.lines ?? []).map((l) => ({ ...l, step: 0 })),
        ...(edgeViz?.lines ?? []).map((l) => ({ ...l, step: 1 })),
      ],
      points: [
        ...(nodeViz.points ?? []).map((p) => ({ ...p, step: 0 })),
        ...(edgeViz?.points ?? []).map((p) => ({ ...p, step: 1 })),
      ],
      rects: [
        ...(nodeViz.rects ?? []).map((r) => ({ ...r, step: 0 })),
        ...(edgeViz?.rects ?? []).map((r) => ({ ...r, step: 1 })),
      ],
      circles: [
        ...(nodeViz.circles ?? []).map((c) => ({ ...c, step: 0 })),
        ...(edgeViz?.circles ?? []).map((c) => ({ ...c, step: 1 })),
      ],
    }
  }
}
