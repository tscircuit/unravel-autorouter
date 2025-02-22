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

  activeSolver?: BaseSolver | null = null
  connMap: ConnectivityMap

  constructor(
    public srj: SimpleRouteJson,
    public opts: CapacityMeshSolverOptions = {},
  ) {
    super()
    this.MAX_ITERATIONS = 1e6
    this.nodeSolver = new CapacityMeshNodeSolver(srj, this.opts)
    this.connMap = this.createConnMap()
    this.colorMap = getColorMap(srj, this.connMap)
  }

  createConnMap() {
    const connMap = new ConnectivityMap({})
    for (const connection of this.srj.connections) {
      for (const point of connection.pointsToConnect) {
        if ("pcb_port_id" in point && point.pcb_port_id) {
          connMap.addConnections([
            [connection.name, point.pcb_port_id as string],
          ])
        }
      }
    }
    return connMap
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
    if (!this.edgeSolver) {
      this.edgeSolver = new CapacityMeshEdgeSolver(
        this.nodeSolver.finishedNodes,
      )
      this.activeSolver = this.edgeSolver
      return
    }
    if (!this.pathingSolver) {
      this.pathingSolver = new CapacityPathingSolver4_FlexibleNegativeCapacity({
        simpleRouteJson: this.srj,
        nodes: this.nodeSolver.finishedNodes,
        edges: this.edgeSolver.edges,
        colorMap: this.colorMap,
        MAX_ITERATIONS: 100_000,
      })
      this.activeSolver = this.pathingSolver
      return
    }
    if (!this.edgeToPortSegmentSolver) {
      this.edgeToPortSegmentSolver = new CapacityEdgeToPortSegmentSolver({
        nodes: this.nodeSolver.finishedNodes,
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
        nodes: this.nodeSolver.finishedNodes,
      })
      this.activeSolver = this.segmentToPointSolver
      return
    }

    if (!this.highDensityRouteSolver) {
      const nodesWithPortPoints =
        this.segmentToPointSolver.getNodesWithPortPoints()
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
