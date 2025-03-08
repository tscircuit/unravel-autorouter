import { InteractiveGraphics } from "graphics-debug/react"
import { CapacityMeshNodeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver1"
import type { SimpleRouteJson } from "lib/types"
import { CapacityMeshEdgeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshEdgeSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { CapacityNodeTargetMerger } from "lib/solvers/CapacityMeshSolver/CapacityNodeTargetMerger"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"
import { CapacityMeshNodeSolver2_NodeUnderObstacle } from "lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver2_NodesUnderObstacles"

const simpleSrj = {
  // const meshSolver = new CapacityMeshNodeSolver({
  bounds: {
    minX: 0,
    maxX: 100,
    minY: 0,
    maxY: 100,
  },
  layerCount: 2,
  minTraceWidth: 1,
  obstacles: [
    {
      center: {
        x: 50,
        y: 50,
      },
      width: 20,
      height: 30,
      type: "rect",
      layers: ["top", "bottom"],
      connectedTo: [],
    },
    {
      center: {
        x: 80,
        y: 50,
      },
      width: 20,
      height: 30,
      type: "rect",
      layers: ["top"],
      connectedTo: [],
    },
    {
      center: {
        x: 80,
        y: 20,
      },
      width: 20,
      height: 40,
      type: "rect",
      layers: ["bottom"],
      connectedTo: [],
    },
  ],
  connections: [
    {
      name: "trace1",
      pointsToConnect: [
        {
          x: 10,
          y: 10,
          layer: "top",
        },
        {
          x: 50,
          y: 90,
          layer: "top",
        },
      ],
    },
    {
      name: "trace2",
      pointsToConnect: [
        {
          x: 10,
          y: 50,
          layer: "top",
        },
        {
          x: 97,
          y: 29,
          layer: "top",
        },
      ],
    },
  ],
} as SimpleRouteJson

export default () => {
  // Solve for mesh nodes using the CapacityMeshNodeSolver
  const nodeSolver = new CapacityMeshNodeSolver2_NodeUnderObstacle(simpleSrj)
  const connMap = getConnectivityMapFromSimpleRouteJson(simpleSrj)
  while (!nodeSolver.solved) {
    nodeSolver.step()
  }

  // Combine finished and unfinished nodes for edge solving
  const allNodes = [...nodeSolver.finishedNodes, ...nodeSolver.unfinishedNodes]

  const nodeTargetMerger = new CapacityNodeTargetMerger(
    allNodes,
    simpleSrj.obstacles,
    connMap,
  )
  nodeTargetMerger.solve()

  // Solve for mesh edges
  const edgeSolver = new CapacityMeshEdgeSolver(nodeTargetMerger.newNodes)
  edgeSolver.solve()

  return (
    <InteractiveGraphics
      graphics={combineVisualizations(
        nodeSolver.visualize(),
        nodeTargetMerger.visualize(),
        edgeSolver.visualize(),
      )}
    />
  )
}
