import type { GraphicsObject } from "graphics-debug"
import { combineVisualizations } from "../../utils/combineVisualizations"
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

interface CapacityMeshSolverOptions {
  capacityDepth?: number
}

export class CapacityMeshSolver extends BaseSolver {
  nodeSolver: CapacityMeshNodeSolver
  edgeSolver?: CapacityMeshEdgeSolver
  pathingSolver?: CapacityPathingSolver
  edgeToPortSegmentSolver?: CapacityEdgeToPortSegmentSolver
  colorMap: Record<string, string>
  segmentToPointSolver?: CapacitySegmentToPointSolver
  highDensityRouteSolver?: HighDensityRouteSolver

  constructor(
    public srj: SimpleRouteJson,
    public opts: CapacityMeshSolverOptions = {},
  ) {
    super()
    this.nodeSolver = new CapacityMeshNodeSolver(srj, this.opts)
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
      return
    }
    if (!this.edgeToPortSegmentSolver) {
      this.edgeToPortSegmentSolver = new CapacityEdgeToPortSegmentSolver({
        nodes: this.nodeSolver.finishedNodes,
        edges: this.edgeSolver.edges,
        capacityPaths: this.pathingSolver!.getCapacityPaths(),
        colorMap: this.colorMap,
      })
      this.edgeToPortSegmentSolver.solve()
      return
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
      return
    }

    if (!this.highDensityRouteSolver) {
      const nodesWithPortPoints =
        this.segmentToPointSolver.getNodesWithPortPoints()
      this.highDensityRouteSolver = new HighDensityRouteSolver({
        nodePortPoints: nodesWithPortPoints,
        colorMap: this.colorMap,
      })
      this.highDensityRouteSolver.solve()
      return
    }

    this.solved = true
  }

  visualize(): GraphicsObject {
    const nodeViz = this.nodeSolver.visualize()
    const edgeViz = this.edgeSolver?.visualize() || {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    const pathingViz = this.pathingSolver?.visualize() || {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    const edgeToPortSegmentViz = this.edgeToPortSegmentSolver?.visualize() || {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    const segmentToPointViz = this.segmentToPointSolver?.visualize() || {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    const highDensityViz = this.highDensityRouteSolver?.visualize() || {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    return combineVisualizations(
      {
        points: [...nodeViz.points!],
        rects: [
          ...nodeViz.rects?.filter((r) => r.label?.includes("obstacle"))!,
        ],
      },
      nodeViz,
      edgeViz,
      pathingViz,
      edgeToPortSegmentViz,
      segmentToPointViz,
      highDensityViz,
    )
  }
}
