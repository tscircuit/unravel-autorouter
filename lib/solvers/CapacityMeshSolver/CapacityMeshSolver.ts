import type { GraphicsObject } from "graphics-debug"
import { combineVisualizations } from "../../utils/combineVisualizations"
import type {
  SimpleRouteJson,
  SimplifiedPcbTrace,
  SimplifiedPcbTraces,
  TraceId,
} from "../../types"
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
import { calculateOptimalCapacityDepth } from "../../utils/getTunedTotalCapacity1"
import { NetToPointPairsSolver } from "../NetToPointPairsSolver/NetToPointPairsSolver"
import { convertHdRouteToSimplifiedRoute } from "lib/utils/convertHdRouteToSimplifiedRoute"
import { mergeRouteSegments } from "lib/utils/mergeRouteSegments"
import { mergeHighDensityRoutes } from "lib/utils/mergeHighDensityRoutes"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

interface CapacityMeshSolverOptions {
  capacityDepth?: number
  targetMinCapacity?: number
}

export class CapacityMeshSolver extends BaseSolver {
  netToPointPairsSolver?: NetToPointPairsSolver
  nodeSolver?: CapacityMeshNodeSolver
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

    // If capacityDepth is not provided, calculate it automatically
    if (opts.capacityDepth === undefined) {
      // Calculate max width/height from bounds for initial node size
      const boundsWidth = srj.bounds.maxX - srj.bounds.minX
      const boundsHeight = srj.bounds.maxY - srj.bounds.minY
      const maxWidthHeight = Math.max(boundsWidth, boundsHeight)

      // Use the calculateOptimalCapacityDepth function to determine the right depth
      const targetMinCapacity = opts.targetMinCapacity ?? 0.5
      opts.capacityDepth = calculateOptimalCapacityDepth(
        maxWidthHeight,
        targetMinCapacity,
      )
    }

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
    if (!this.netToPointPairsSolver) {
      this.netToPointPairsSolver = new NetToPointPairsSolver(
        this.srj,
        this.colorMap,
      )
      this.activeSolver = this.netToPointPairsSolver
      return
    }
    if (!this.nodeSolver) {
      const newSrj = this.netToPointPairsSolver.getNewSimpleRouteJson()
      this.connMap = getConnectivityMapFromSimpleRouteJson(newSrj)
      this.colorMap = getColorMap(newSrj, this.connMap)
      this.nodeSolver = new CapacityMeshNodeSolver(newSrj, this.opts)
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
        simpleRouteJson: this.netToPointPairsSolver.getNewSimpleRouteJson(),
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
    const netToPPSolver = this.netToPointPairsSolver?.visualize()
    const nodeViz = this.nodeSolver?.visualize()
    const edgeViz = this.edgeSolver?.visualize()
    const pathingViz = this.pathingSolver?.visualize()
    const edgeToPortSegmentViz = this.edgeToPortSegmentSolver?.visualize()
    const segmentToPointViz = this.segmentToPointSolver?.visualize()
    const segmentOptimizationViz = this.segmentToPointOptimizer?.visualize()
    const highDensityViz = this.highDensityRouteSolver?.visualize()
    const problemViz = {
      points: [...this.srj.connections.flatMap((c) => c.pointsToConnect)],
      rects: [
        ...(this.srj.obstacles ?? []).map((o) => ({
          ...o,
          fill: "rgba(255,0,0,0.25)",
        })),
      ],
    }
    const visualizations = [
      problemViz,
      netToPPSolver,
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

  /**
   * Simplifies a route by merging consecutive points along the same line
   */
  private simplifyRoute(points: Array<{ x: number; y: number; z: number }>) {
    if (points.length <= 2) return points

    const result: Array<{ x: number; y: number; z: number }> = [points[0]]

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      // Skip current point if it lies on the same line as previous and next
      // and has the same z-coordinate
      if (curr.z === prev.z && curr.z === next.z) {
        const dx1 = curr.x - prev.x
        const dy1 = curr.y - prev.y
        const dx2 = next.x - curr.x
        const dy2 = next.y - curr.y

        // Check if the vectors are parallel (same direction)
        // For parallel vectors, cross product should be close to zero
        // and dot product should be positive (same direction)
        const crossProduct = dx1 * dy2 - dy1 * dx2
        const dotProduct = dx1 * dx2 + dy1 * dy2

        if (Math.abs(crossProduct) < 0.001 && dotProduct > 0) {
          continue
        }
      }

      result.push(curr)
    }

    // Always add the last point
    result.push(points[points.length - 1])

    return result
  }

  /**
   * Get original connection name from connection name with MST suffix
   * @param mstConnectionName The MST-suffixed connection name (e.g. "connection1_mst0")
   * @returns The original connection name (e.g. "connection1")
   */
  private getOriginalConnectionName(mstConnectionName: string): string {
    // MST connections are named like "connection_mst0", so extract the original name
    const match = mstConnectionName.match(/^(.+?)_mst\d+$/)
    return match ? match[1] : mstConnectionName
  }

  /**
   * Returns the SimpleRouteJson with routes converted to SimplifiedPcbTraces
   */
  getOutputSimplifiedPcbTraces(): SimplifiedPcbTraces {
    if (!this.solved || !this.highDensityRouteSolver) {
      throw new Error("Cannot get output before solving is complete")
    }

    const traces: SimplifiedPcbTraces = []

    for (const connection of this.netToPointPairsSolver?.newConnections ?? []) {
      const netConnection = this.srj.connections.find(
        (c) => c.name === connection.netConnectionName,
      )

      // Find all the hdRoutes that correspond to this connection
      const hdRoutes = this.highDensityRouteSolver.routes.filter(
        (r) => r.connectionName === connection.name,
      )

      const [start, end] = connection.pointsToConnect

      const startZ = mapLayerNameToZ(start.layer, this.srj.layerCount)
      const endZ = mapLayerNameToZ(end.layer, this.srj.layerCount)

      // Merge the hdRoutes into a single hdRoute
      const mergedHdRoute = mergeHighDensityRoutes(
        hdRoutes,
        { ...start, z: startZ },
        { ...end, z: endZ },
      )

      const simplifiedPcbTrace: SimplifiedPcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: connection.name,
        connection_name: this.getOriginalConnectionName(connection.name),
        route: convertHdRouteToSimplifiedRoute(
          mergedHdRoute,
          this.srj.layerCount,
        ),
      }

      traces.push(simplifiedPcbTrace)

      // Convert the merged route points to a SimplifiedPcbTraces
    }

    // for (const hdRoute of this.highDensityRouteSolver.routes) {
    //   const pointPairConnName = hdRoute.connectionName

    //   const trace: SimplifiedPcbTraces[number] = {
    //     type: "pcb_trace",
    //     pcb_trace_id: pointPairConnName,
    //     connection_name: this.getOriginalConnectionName(pointPairConnName),
    //     route: convertHdRouteToSimplifiedRoute(hdRoute, 2),
    //   }

    //   traces.push(trace)
    // }

    return {
      ...this.srj,
      traces,
    }
  }

  getOutputSimpleRouteJson(): SimpleRouteJson {
    return {
      ...this.srj,
      traces: this.getOutputSimplifiedPcbTraces(),
    }
  }
}
