import cn159 from "examples/assets/cn159-nodeWithPortPoints.json"
import { IntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/IntraNodeSolver"
import { SingleHighDensityRouteSolver } from "lib/solvers/HighDensitySolver/SingleHighDensityRouteSolver"
import {TwoCrossingRoutesHighDensitySolver} from "lib/solvers/HighDensitySolver/TwoRouteHighDensitySolver/TwoCrossingRoutesHighDensitySolver"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"

export default () => {
  return (
    <GenericSolverDebugger 
      createSolver={() =>
        new TwoCrossingRoutesHighDensitySolver({
          nodeWithPortPoints: cn159.nodeWithPortPoints,
        })
      }
    />
  )
  // return (
  //   <HyperHighDensityDebugger nodeWithPortPoints={cn159.nodeWithPortPoints} />
  // )
  // return (
  //   <GenericSolverDebugger
  //     createSolver={() =>
  //       new IntraNodeRouteSolver({
  //         nodeWithPortPoints: cn159.nodeWithPortPoints,
  //         hyperParameters: {
  //           SHUFFLE_SEED: 1,
  //         },
  //       })
  //     }
  //   />
  // )
}
