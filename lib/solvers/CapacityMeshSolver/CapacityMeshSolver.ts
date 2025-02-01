import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../types"
import { BaseSolver } from "../BaseSolver"
import { CapacityMeshEdgeSolver } from "./CapacityMeshEdgeSolver"
import { CapacityMeshNodeSolver } from "./CapacityMeshNodeSolver"
import { CapacityPathingSolver } from "./CapacityPathingSolver"

export class CapacityMeshSolver extends BaseSolver {
  nodeSolver: CapacityMeshNodeSolver
  edgeSolver?: CapacityMeshEdgeSolver
  pathingSolver?: CapacityPathingSolver

  constructor(public srj: SimpleRouteJson) {
    super()
    this.nodeSolver = new CapacityMeshNodeSolver(srj)
  }

  step() {
    if (!this.nodeSolver.solved) {
      this.nodeSolver.solve()
      return
    }
    if (!this.edgeSolver) {
      this.edgeSolver = new CapacityMeshEdgeSolver(
        this.nodeSolver.finishedNodes,
      )
      this.edgeSolver.solve()
      return
    }
    if (!this.pathingSolver) {
      this.pathingSolver = new CapacityPathingSolver({
        simpleRouteJson: this.srj,
        nodes: this.nodeSolver.finishedNodes,
        edges: this.edgeSolver.edges,
      })
      this.pathingSolver.solve()
    }

    this.solved = true
  }

  visualize(): GraphicsObject {
    const nodeViz = this.nodeSolver.visualize()
    const edgeViz = this.edgeSolver?.visualize()
    const pathingViz = this.pathingSolver?.visualize()
    return {
      lines: [
        ...(nodeViz.lines ?? []).map((l) => ({ ...l, step: 0 })),
        ...(edgeViz?.lines ?? []).map((l) => ({ ...l, step: 1 })),
        ...(pathingViz?.lines ?? []).map((l) => ({ ...l, step: 2 })),
      ],
      points: [
        ...(nodeViz.points ?? []).map((p) => ({ ...p, step: 0 })),
        ...(edgeViz?.points ?? []).map((p) => ({ ...p, step: 1 })),
        ...(pathingViz?.points ?? []).map((p) => ({ ...p, step: 2 })),
      ],
      rects: [
        ...(nodeViz.rects ?? []).map((r) => ({ ...r, step: 0 })),
        ...(edgeViz?.rects ?? []).map((r) => ({ ...r, step: 1 })),
        ...(pathingViz?.rects ?? []).map((r) => ({ ...r, step: 2 })),
      ],
      circles: [
        ...(nodeViz.circles ?? []).map((c) => ({ ...c, step: 0 })),
        ...(edgeViz?.circles ?? []).map((c) => ({ ...c, step: 1 })),
        ...(pathingViz?.circles ?? []).map((c) => ({ ...c, step: 2 })),
      ],
    }
  }
}
