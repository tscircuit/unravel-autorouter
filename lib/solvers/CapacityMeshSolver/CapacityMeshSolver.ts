import type { GraphicsObject } from "graphics-debug"
import { combineVisualizations } from "../../utils/combineVisualizations"
import type { SimpleRouteJson } from "../../types"
import { BaseSolver } from "../BaseSolver"
import { CapacityMeshEdgeSolver } from "./CapacityMeshEdgeSolver"
import { CapacityMeshNodeSolver } from "./CapacityMeshNodeSolver"
import { CapacityPathingSolver } from "../CapacityPathingSolver/CapacityPathingSolver"
import { CapacityEdgeToPortSegmentSolver } from "./CapacityEdgeToPortSegmentSolver"
import { getColorMap } from "../colors"
import { CapacitySegmentToPointSolver } from "./CapacitySegmentToPointSolver"
import { HighDensityRouteSolver } from "../HighDensitySolver/HighDensityRouteSolver"
import type { NodePortSegment } from "../../types/capacity-edges-to-port-segments-types"
import { CapacityPathingSolver2_AvoidLowCapacity } from "../CapacityPathingSolver/CapacityPathingSolver2_AvoidLowCapacity"
import { CapacityPathingSolver3_FlexibleNegativeCapacity_AvoidLowCapacity } from "../CapacityPathingSolver/CapacityPathingSolver3_FlexibleNegativeCapacity_AvoidLowCapacity"
import { CapacityPathingSolver4_FlexibleNegativeCapacity } from "../CapacityPathingSolver/CapacityPathingSolver4_FlexibleNegativeCapacity_AvoidLowCapacity_FixedDistanceCost"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"
import { CapacityNodeTargetMerger } from "./CapacityNodeTargetMerger"
import { CapacitySegmentPointOptimizer } from "../CapacitySegmentPointOptimizer/CapacitySegmentPointOptimizer"

interface CapacityMeshSolverOptions {
  capacityDepth?: number
}

export class CapacityMeshSolver extends BaseSolver {
  nodeSolver: CapacityMeshNodeSolver
  nodeTargetMerger?: CapacityNodeTargetMerger
  edgeSolver?: CapacityMeshEdgeSolver
  pathingSolver?: CapacityPathingSolver
  edgeToPortSegmentSolver?: CapacityEdgeToPortSegmentSolver
  colorMap: Record<string, string>
  segmentToPointSolver?: CapacitySegmentToPointSolver
  segmentToPointOptimizer?: CapacitySegmentPointOptimizer
  highDensityRouteSolver?: HighDensityRouteSolver

  activeSolver?: BaseSolver | null = null
  connMap: ConnectivityMap

  constructor(
    public srj: SimpleRouteJson,
    public opts: CapacityMeshSolverOptions = {},
  ) {
    super()
    this.MAX_ITERATIONS = 1e6
    this.nodeSolver = new CapacityMeshNodeSolver(srj, this.opts)
    this.connMap = getConnectivityMapFromSimpleRouteJson(srj)
    this.colorMap = getColorMap(srj, this.connMap)
  }

  _step() {
    if (this.activeSolver) {
      this.activeSolver.step()
      if (this.activeSolver.solved) {
        this.activeSolver = null
      } else if (this.activeSolver.failed) {
        this.error = this.activeSolver?.error
        this.failed = true
        this.activeSolver = null
      }
      return
    }
    // PROGRESS TO NEXT SOLVER
    if (!this.nodeSolver.solved) {
      this.activeSolver = this.nodeSolver
      return
    }
    if (!this.nodeTargetMerger) {
      this.nodeTargetMerger = new CapacityNodeTargetMerger(
        this.nodeSolver.finishedNodes,
        this.srj.obstacles,
        this.connMap,
      )
      this.activeSolver = this.nodeTargetMerger
      return
    }
    // const nodes = this.nodeSolver.finishedNodes
    const nodes = this.nodeTargetMerger.newNodes
    if (!this.edgeSolver) {
      this.edgeSolver = new CapacityMeshEdgeSolver(nodes)
      this.activeSolver = this.edgeSolver
      return
    }
    if (!this.pathingSolver) {
      this.pathingSolver = new CapacityPathingSolver4_FlexibleNegativeCapacity({
        simpleRouteJson: this.srj,
        nodes,
        edges: this.edgeSolver.edges,
        colorMap: this.colorMap,
        hyperParameters: {
          MAX_CAPACITY_FACTOR: 1,
        },
      })
      this.activeSolver = this.pathingSolver
      return
    }
    if (!this.edgeToPortSegmentSolver) {
      this.edgeToPortSegmentSolver = new CapacityEdgeToPortSegmentSolver({
        nodes,
        edges: this.edgeSolver.edges,
        capacityPaths: this.pathingSolver!.getCapacityPaths(),
        colorMap: this.colorMap,
      })
      this.activeSolver = this.edgeToPortSegmentSolver
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
        nodes,
      })
      this.activeSolver = this.segmentToPointSolver
      return
    }
    if (!this.segmentToPointOptimizer) {
      this.segmentToPointOptimizer = new CapacitySegmentPointOptimizer({
        assignedSegments: this.segmentToPointSolver.solvedSegments,
        colorMap: this.colorMap,
        nodes,
      })
      this.activeSolver = this.segmentToPointOptimizer
      return
    }

    if (!this.highDensityRouteSolver) {
      const nodesWithPortPoints =
        this.segmentToPointOptimizer.getNodesWithPortPoints()
      this.highDensityRouteSolver = new HighDensityRouteSolver({
        nodePortPoints: nodesWithPortPoints,
        colorMap: this.colorMap,
        connMap: this.connMap,
      })
      this.activeSolver = this.highDensityRouteSolver
      return
    }

    this.solved = true
  }

  visualize(): GraphicsObject {
    if (!this.solved && this.activeSolver) return this.activeSolver.visualize()
    const nodeViz = this.nodeSolver.visualize()
    const edgeViz = this.edgeSolver?.visualize()
    const pathingViz = this.pathingSolver?.visualize()
    const edgeToPortSegmentViz = this.edgeToPortSegmentSolver?.visualize()
    const segmentToPointViz = this.segmentToPointSolver?.visualize()
    const segmentOptimizationViz = this.segmentToPointOptimizer?.visualize()
    const highDensityViz = this.highDensityRouteSolver?.visualize()
    const problemViz = {
      points: [...nodeViz.points!],
      rects: [...nodeViz.rects?.filter((r) => r.label?.includes("obstacle"))!],
    }
    const visualizations = [
      problemViz,
      nodeViz,
      edgeViz,
      pathingViz,
      edgeToPortSegmentViz,
      segmentToPointViz,
      segmentOptimizationViz,
      highDensityViz ? combineVisualizations(problemViz, highDensityViz) : null,
    ].filter(Boolean) as GraphicsObject[]
    // return visualizations[visualizations.length - 1]
    return combineVisualizations(...visualizations)
  }
}
