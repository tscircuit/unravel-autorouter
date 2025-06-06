import { InteractiveGraphics } from "graphics-debug/react"
import { CapacityMeshNodeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver1"
import type { SimpleRouteJson } from "lib/types"
import { CapacityMeshEdgeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { CapacityPathingSolver } from "lib/solvers/CapacityPathingSolver/CapacityPathingSolver"
import { getColorMap } from "lib/solvers/colors"
import { CapacityPathingSolver4_FlexibleNegativeCapacity } from "lib/solvers/CapacityPathingSolver/CapacityPathingSolver4_FlexibleNegativeCapacity_AvoidLowCapacity_FixedDistanceCost"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"
import { CapacityNodeTargetMerger } from "lib/solvers/CapacityNodeTargetMerger/CapacityNodeTargetMerger"

const simpleSrj = {
  bounds: {
    minX: 0,
    maxX: 100,
    minY: 0,
    maxY: 100,
  },
  layerCount: 1,
  minTraceWidth: 1,
  obstacles: [
    {
      center: {
        x: 50,
        y: 50,
      },
      width: 20,
      height: 10,
      type: "rect",
      layers: ["top", "bottom"],
      connectedTo: [],
    },
    {
      center: {
        x: 55,
        y: 90,
      },
      width: 20,
      height: 10,
      type: "rect",
      layers: ["top", "bottom"],
      connectedTo: [],
    },
    {
      center: {
        x: 15,
        y: 10,
      },
      width: 50,
      height: 10,
      type: "rect",
      layers: ["top", "bottom"],
      connectedTo: [],
    },
  ],
  connections: [
    {
      name: "trace1",
      pointsToConnect: [
        {
          x: 15,
          y: 10,
          layer: "top",
        },
        {
          x: 55,
          y: 90,
          layer: "top",
        },
      ],
    },
    {
      name: "trace2",
      pointsToConnect: [
        {
          x: 40,
          y: 10,
          layer: "top",
        },
        {
          x: 40,
          y: 50,
          layer: "top",
        },
      ],
    },
    {
      name: "trace3",
      pointsToConnect: [
        {
          x: 0,
          y: 0,
          layer: "top",
        },
        {
          x: 100,
          y: 100,
          layer: "top",
        },
      ],
    },
  ],
} as SimpleRouteJson

export default () => {
  const connMap = getConnectivityMapFromSimpleRouteJson(simpleSrj)
  // Solve for mesh nodes using the CapacityMeshNodeSolver
  const nodeSolver = new CapacityMeshNodeSolver(simpleSrj)
  nodeSolver.solve()

  // Combine finished and unfinished nodes for edge solving
  let allNodes = [...nodeSolver.finishedNodes, ...nodeSolver.unfinishedNodes]

  const nodeTargetMerger = new CapacityNodeTargetMerger(
    allNodes,
    simpleSrj.obstacles,
    connMap,
  )
  nodeTargetMerger.solve()

  allNodes = nodeTargetMerger.newNodes

  // Solve for mesh edges
  const edgeSolver = new CapacityMeshEdgeSolver(nodeTargetMerger.newNodes)
  edgeSolver.solve()

  // Get color map for visualization
  const colorMap = getColorMap(simpleSrj)

  // Create and solve capacity pathing
  const pathingSolver = new CapacityPathingSolver4_FlexibleNegativeCapacity({
    simpleRouteJson: simpleSrj,
    nodes: allNodes,
    edges: edgeSolver.edges,
    colorMap,
    hyperParameters: {
      MAX_CAPACITY_FACTOR: 1 / 10,
    },
  })

  pathingSolver.solve()

  return (
    <InteractiveGraphics
      graphics={combineVisualizations(
        // nodeSolver.visualize(),
        // nodeTargetMerger.visualize(),
        // edgeSolver.visualize(),
        pathingSolver.visualize(),
      )}
    />
  )
}
