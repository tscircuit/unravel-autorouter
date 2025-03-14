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
    // The JSON contains routes as first array item and obstacles as second array item
    const routes = inputData[0] as any[]
    const obstacles = inputData[1] as any[]

    return new MultiSimplifiedPathSolver({
      unsimplifiedHdRoutes: routes,
      obstacles,
      connMap: new ConnectivityMap({}),
      colorMap: createColorMapFromStrings(routes.map((r) => r.connectionName)),
    })
  }

  return <GenericSolverDebugger createSolver={createSolver} />
}
