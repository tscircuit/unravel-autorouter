import cn38186 from "examples/assets/cn38186-nodeWithPortPoints.json"
import React from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

export default () => (
  <GenericSolverDebugger
    createSolver={() => {
      const solver = new MultiHeadPolyLineIntraNodeSolver({
        nodeWithPortPoints: cn38186.nodeWithPortPoints,
      })
      return solver
    }}
  />
)
