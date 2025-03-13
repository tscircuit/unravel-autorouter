import { useMemo } from "react"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { SingleSimplifiedPathSolver2 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver2"
import inputData from "examples/assets/simplifiedpathsolver1.json"
import { SingleSimplifiedPathSolver4 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver4_DistanceBased"
import { SingleSimplifiedPathSolver5 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver5_Deg45"
import { MultiSimplifiedPathSolver } from "lib/solvers/SimplifiedPathSolver/MultiSimplifiedPathSolver"

export default () => {
  const createSolver = () => {
    // The JSON contains routes as first array item and obstacles as second array item
    const routes = inputData[0] as any[]
    const obstacles = inputData[1] as any[]

    return new MultiSimplifiedPathSolver(routes, obstacles)
  }

  return <GenericSolverDebugger createSolver={createSolver} />
}
