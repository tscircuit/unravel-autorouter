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
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import { MultipleHighDensityRouteStitchSolver } from "../RouteStitchingSolver/MultipleHighDensityRouteStitchSolver"

interface CapacityMeshSolverOptions {
  capacityDepth?: number
  targetMinCapacity?: number
}

type PipelineStep<T extends new (...args: any[]) => BaseSolver> = {
  solverName: string
  solverClass: T
  getConstructorParams: (
    instance: CapacityMeshSolver,
  ) => ConstructorParameters<T>
  onSolved?: (instance: CapacityMeshSolver) => void
}

function definePipelineStep<
  T extends new (
    ...args: any[]
  ) => BaseSolver,
  const P extends ConstructorParameters<T>,
>(
  solverName: keyof CapacityMeshSolver,
  solverClass: T,
  getConstructorParams: (instance: CapacityMeshSolver) => P,
  opts: {
    onSolved?: (instance: CapacityMeshSolver) => void
  } = {},
): PipelineStep<T> {
  return {
    solverName,
    solverClass,
    getConstructorParams,
    onSolved: opts.onSolved,
  }
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
  highDensityStitchSolver?: MultipleHighDensityRouteStitchSolver

  activeSolver?: BaseSolver | null = null
  connMap: ConnectivityMap

  pipelineDef = [
    definePipelineStep(
      "netToPointPairsSolver",
      NetToPointPairsSolver,
      (cms) => [cms.srj, cms.colorMap],
    ),
    definePipelineStep("nodeSolver", CapacityMeshNodeSolver, (cms) => [
      cms.netToPointPairsSolver?.getNewSimpleRouteJson() || cms.srj,
      cms.opts,
    ]),
    definePipelineStep("nodeTargetMerger", CapacityNodeTargetMerger, (cms) => [
      cms.nodeSolver?.finishedNodes || [],
      cms.srj.obstacles,
      cms.connMap,
    ]),
    definePipelineStep("edgeSolver", CapacityMeshEdgeSolver, (cms) => [
      cms.nodeTargetMerger?.newNodes || [],
    ]),
    definePipelineStep(
      "pathingSolver",
      CapacityPathingSolver4_FlexibleNegativeCapacity,
      (cms) => [
        {
          simpleRouteJson:
            cms.netToPointPairsSolver?.getNewSimpleRouteJson() || cms.srj,
          nodes: cms.nodeTargetMerger?.newNodes || [],
          edges: cms.edgeSolver?.edges || [],
          colorMap: cms.colorMap,
          hyperParameters: {
            MAX_CAPACITY_FACTOR: 1,
          },
        },
      ],
    ),
    definePipelineStep(
      "edgeToPortSegmentSolver",
      CapacityEdgeToPortSegmentSolver,
      (cms) => [
        {
          nodes: cms.nodeTargetMerger?.newNodes || [],
          edges: cms.edgeSolver?.edges || [],
          capacityPaths: cms.pathingSolver?.getCapacityPaths() || [],
          colorMap: cms.colorMap,
        },
      ],
    ),
    definePipelineStep(
      "segmentToPointSolver",
      CapacitySegmentToPointSolver,
      (cms) => {
        const allSegments: NodePortSegment[] = []
        if (cms.edgeToPortSegmentSolver?.nodePortSegments) {
          cms.edgeToPortSegmentSolver.nodePortSegments.forEach((segs) => {
            allSegments.push(...segs)
          })
        }
        return [
          {
            segments: allSegments,
            colorMap: cms.colorMap,
            nodes: cms.nodeTargetMerger?.newNodes || [],
          },
        ]
      },
    ),
    definePipelineStep(
      "segmentToPointOptimizer",
      CapacitySegmentPointOptimizer,
      (cms) => [
        {
          assignedSegments: cms.segmentToPointSolver?.solvedSegments || [],
          colorMap: cms.colorMap,
          nodes: cms.nodeTargetMerger?.newNodes || [],
        },
      ],
    ),
    definePipelineStep(
      "highDensityRouteSolver",
      HighDensityRouteSolver,
      (cms) => [
        {
          nodePortPoints:
            cms.segmentToPointOptimizer?.getNodesWithPortPoints() || [],
          colorMap: cms.colorMap,
          connMap: cms.connMap,
        },
      ],
    ),
    definePipelineStep(
      "highDensityStitchSolver",
      MultipleHighDensityRouteStitchSolver,
      (cms) => [
        {
          connections: cms.srj.connections,
          hdRoutes: cms.highDensityRouteSolver!.routes,
          layerCount: cms.srj.layerCount,
        },
      ],
    ),
  ]

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

  currentPipelineStepIndex = 0
  _step() {
    if (this.activeSolver) {
      this.activeSolver.step()
      if (this.activeSolver.solved) {
        this.activeSolver = null
        this.currentPipelineStepIndex++
      } else if (this.activeSolver.failed) {
        this.error = this.activeSolver?.error
        this.failed = true
        this.activeSolver = null
      }
      return
    }

    const pipelineStepDef = this.pipelineDef[this.currentPipelineStepIndex]
    if (!pipelineStepDef) {
      this.solved = true
      return
    }

    const constructorParams = pipelineStepDef.getConstructorParams(this)
    this.activeSolver = new pipelineStepDef.solverClass(
      ...(constructorParams as [any, any, any]),
    )
    ;(this as any)[pipelineStepDef.solverName] = this.activeSolver
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
      // const mergedHdRoute = mergeHighDensityRoutes(
      //   hdRoutes,
      //   { ...start, z: startZ },
      //   { ...end, z: endZ },
      // )

      const simplifiedPcbTrace: SimplifiedPcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: connection.name,
        connection_name: this.getOriginalConnectionName(connection.name),
        route: convertHdRouteToSimplifiedRoute(
          hdRoutes[0],
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

    return traces
  }

  getOutputSimpleRouteJson(): SimpleRouteJson {
    return {
      ...this.srj,
      traces: this.getOutputSimplifiedPcbTraces(),
    }
  }
}
