import cn818 from "examples/assets/cn818-nodeWithPortPoints.json"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"

export const hyperParameters = {
  SEGMENTS_PER_POLYLINE: 6,
}

export default () => {
  return (
    <HyperHighDensityDebugger nodeWithPortPoints={cn818.nodeWithPortPoints} />
    // <GenericSolverDebugger
    //   createSolver={() =>
    //     new MultiHeadPolyLineIntraNodeSolver3({
    //       nodeWithPortPoints: cn310.nodeWithPortPoints,
    //       hyperParameters,
    //     })
    //   }
    // />
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
