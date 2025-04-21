import React from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

const nodeWithPortPoints = {
  capacityMeshNodeId: "node1",
  center: { x: 5, y: 5 },
  width: 10,
  height: 10,
  portPoints: [
    { connectionName: "A", x: 2, y: 0, z: 0 },
    { connectionName: "A", x: 8, y: 10, z: 0 },
    { connectionName: "B", x: 5, y: 0, z: 0 },
    { connectionName: "B", x: 0, y: 10, z: 0 },
  ],
}

export default () => (
  <GenericSolverDebugger
    createSolver={() => {
      const solver = new MultiHeadPolyLineIntraNodeSolver({
        nodeWithPortPoints,
      })
      return solver
    }}
  />
)
