import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../types"
import { BaseSolver } from "../BaseSolver"
import { CapacityMeshEdgeSolver } from "./CapacityMeshEdgeSolver"
import { CapacityMeshNodeSolver } from "./CapacityMeshNodeSolver"
import { CapacityPathingSolver } from "./CapacityPathingSolver"
import { CapacityEdgeToPortSegmentSolver } from "./CapacityEdgeToPortSegmentSolver"
import { getColorMap } from "../colors"
import { CapacitySegmentToPointSolver } from "./CapacitySegmentToPointSolver"
import { HighDensityRouteSolver } from "../HighDensitySolver/HighDensityRouteSolver"
import type { NodePortSegment } from "../../types/capacity-edges-to-port-segments-types"

export class CapacityMeshSolver extends BaseSolver {
  nodeSolver: CapacityMeshNodeSolver
  edgeSolver?: CapacityMeshEdgeSolver
  pathingSolver?: CapacityPathingSolver
  edgeToPortSegmentSolver?: CapacityEdgeToPortSegmentSolver
  colorMap: Record<string, string>
  segmentToPointSolver?: CapacitySegmentToPointSolver
  highDensityRouteSolver?: HighDensityRouteSolver

  constructor(public srj: SimpleRouteJson) {
    super()
    this.nodeSolver = new CapacityMeshNodeSolver(srj)
    this.colorMap = getColorMap(srj)
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
        colorMap: this.colorMap,
      })
      this.pathingSolver.solve()
    }
    if (!this.edgeToPortSegmentSolver) {
      this.edgeToPortSegmentSolver = new CapacityEdgeToPortSegmentSolver({
        nodes: this.nodeSolver.finishedNodes,
        edges: this.edgeSolver.edges,
        capacityPaths: this.pathingSolver!.getCapacityPaths(),
        colorMap: this.colorMap,
      })
      this.edgeToPortSegmentSolver.solve()
    }
    if (!this.segmentToPointSolver) {
      const allSegments: NodePortSegment[] = []
      this.edgeToPortSegmentSolver.nodePortSegments.forEach((segs) => {
        allSegments.push(...segs)
      })
      this.segmentToPointSolver = new CapacitySegmentToPointSolver({
        segments: allSegments,
        colorMap: this.colorMap,
        nodes: this.nodeSolver.finishedNodes,
      })
      this.segmentToPointSolver.solve()
    }

    if (!this.highDensityRouteSolver) {
      const nodesWithPortPoints =
        this.segmentToPointSolver.getNodesWithPortPoints()
      this.highDensityRouteSolver = new HighDensityRouteSolver({
        nodePortPoints: nodesWithPortPoints,
        colorMap: this.colorMap,
      })
      this.highDensityRouteSolver.solve()
    }

    this.solved = true
  }

  visualize(): GraphicsObject {
    const nodeViz = this.nodeSolver.visualize()
    const edgeViz = this.edgeSolver?.visualize()
    const pathingViz = this.pathingSolver?.visualize()
    const edgeToPortSegmentViz = this.edgeToPortSegmentSolver?.visualize()
    const segmentToPointViz = this.segmentToPointSolver?.visualize()
    return {
      lines: [
        ...(nodeViz.lines ?? []).map((l) => ({ ...l, step: 0 })),
        ...(edgeViz?.lines ?? []).map((l) => ({ ...l, step: 1 })),
        ...(pathingViz?.lines ?? []).map((l) => ({ ...l, step: 2 })),
        ...(edgeToPortSegmentViz?.lines ?? []).map((l) => ({ ...l, step: 3 })),
        ...(segmentToPointViz?.lines ?? []).map((l) => ({ ...l, step: 4 })),
        ...(this.highDensityRouteSolver?.visualize().lines ?? []).map((l) => ({
          ...l,
          step: 5,
        })),
      ],
      points: [
        ...(nodeViz.points ?? []).map((p) => ({ ...p, step: 0 })),
        ...(edgeViz?.points ?? []).map((p) => ({ ...p, step: 1 })),
        ...(pathingViz?.points ?? []).map((p) => ({ ...p, step: 2 })),
        ...(edgeToPortSegmentViz?.points ?? []).map((p) => ({ ...p, step: 3 })),
        ...(segmentToPointViz?.points ?? []).map((p) => ({ ...p, step: 4 })),
        ...(this.highDensityRouteSolver?.visualize().points ?? []).map((p) => ({
          ...p,
          step: 5,
        })),
      ],
      rects: [
        ...(nodeViz.rects ?? []).map((r) => ({ ...r, step: 0 })),
        ...(edgeViz?.rects ?? []).map((r) => ({ ...r, step: 1 })),
        ...(pathingViz?.rects ?? []).map((r) => ({ ...r, step: 2 })),
        ...(edgeToPortSegmentViz?.rects ?? []).map((r) => ({ ...r, step: 3 })),
        ...(segmentToPointViz?.rects ?? []).map((r) => ({ ...r, step: 4 })),
        ...(this.highDensityRouteSolver?.visualize().rects ?? []).map((r) => ({
          ...r,
          step: 5,
        })),
      ],
      circles: [
        ...(nodeViz.circles ?? []).map((c) => ({ ...c, step: 0 })),
        ...(edgeViz?.circles ?? []).map((c) => ({ ...c, step: 1 })),
        ...(pathingViz?.circles ?? []).map((c) => ({ ...c, step: 2 })),
        ...(edgeToPortSegmentViz?.circles ?? []).map((c) => ({
          ...c,
          step: 3,
        })),
        ...(segmentToPointViz?.circles ?? []).map((c) => ({ ...c, step: 4 })),
        ...(this.highDensityRouteSolver?.visualize().circles ?? []).map(
          (c) => ({ ...c, step: 5 }),
        ),
      ],
    }
  }
}
