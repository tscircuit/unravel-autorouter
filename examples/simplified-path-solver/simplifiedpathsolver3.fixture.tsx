import { useMemo } from "react"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { SingleSimplifiedPathSolver2 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver2"
import inputData from "examples/assets/simplifiedpathsolver1.json"
import { SingleSimplifiedPathSolver4 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver4_DistanceBased"
import { SingleSimplifiedPathSolver5 } from "lib/solvers/SimplifiedPathSolver/SingleSimplifiedPathSolver5_Deg45"

export default () => {
  const createSolver = () => {
    // The JSON contains routes as first array item and obstacles as second array item
    const routes = inputData[0] as any[]
    const obstacles = inputData[1] as any[]

    // Use the first route as input route and the rest as other routes
    const inputRoute = routes[1]
    const otherRoutes = [routes[0], ...routes.slice(2)]

    return new SingleSimplifiedPathSolver5(inputRoute, otherRoutes, obstacles)
  }

  return (
    <GenericSolverDebugger createSolver={createSolver} animationSpeed={100} />
  )
}
