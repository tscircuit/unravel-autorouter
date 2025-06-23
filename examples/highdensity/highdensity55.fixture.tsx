import cn628 from "examples/assets/cn628-nodeWithPortPoints.json"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"

export const hyperParameters = {
  MULTI_HEAD_POLYLINE_SOLVER: true,
  SEGMENTS_PER_POLYLINE: 6,
  BOUNDARY_PADDING: -0.05,
}

export default () => {
  return (
    <GenericSolverDebugger
      createSolver={() =>
        new MultiHeadPolyLineIntraNodeSolver({
          nodeWithPortPoints: cn628.nodeWithPortPoints,
          hyperParameters,
        })
      }
    />
  )
}
