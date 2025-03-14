import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { SingleSimplifiedPathSolver2 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver2"
import inputData from "examples/assets/simplifiedpathsolver4.json"
import { SingleSimplifiedPathSolver4 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver4_DistanceBased"
import { SingleSimplifiedPathSolver5 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver5_Deg45"
import { MultiSimplifiedPathSolver } from "lib/solvers/SimplifiedPathSolver/MultiSimplifiedPathSolver"
import { createColorMapFromStrings } from "lib/solvers/colors"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"

export default () => {
  const createSolver = () => {
    return new MultiSimplifiedPathSolver({
      ...(inputData[0] as any),
      connMap: new ConnectivityMap(inputData[0].connMap.netMap),
    })
  }

  return <GenericSolverDebugger createSolver={createSolver} />
}
