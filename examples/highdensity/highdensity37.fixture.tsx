import cn8724 from "examples/assets/cn8724-nodeWithPortPoints.json"
import { IntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/IntraNodeSolver"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"

export const hyperParameters = {
  CELL_SIZE_FACTOR: 2,
  VIA_PENALTY_FACTOR_2: 10,
}

export default () => {
  return (
    <HyperHighDensityDebugger nodeWithPortPoints={cn8724.nodeWithPortPoints} />
    // <GenericSolverDebugger
    //   createSolver={() =>
    //     new IntraNodeRouteSolver({
    //       nodeWithPortPoints: cn62169.nodeWithPortPoints,
    //       colorMap: generateColorMapFromNodeWithPortPoints(
    //         cn62169.nodeWithPortPoints,
    //       ),
    //       hyperParameters,
    //     })
    //   }
    // />
  )
}
