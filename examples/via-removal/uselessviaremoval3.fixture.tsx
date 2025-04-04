import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { UselessViaRemovalSolver } from "lib/solvers/UselessViaRemovalSolver/UselessViaRemovalSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

// Create a test case with a route that has an unnecessary layer change in a straight line
const createSolver = () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      // A route with an unnecessary layer change in the middle
      connectionName: "route1",
      route: [
        { x: 10, y: 10, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 }, // Unnecessary layer change
        { x: 90, y: 90, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
  }

  return new UselessViaRemovalSolver({ routes, colorMap })
}

// The solver should optimize this by removing the via and keeping the route on layer 0
export default () => (
  <GenericSolverDebugger
    createSolver={createSolver}
    animationSpeed={500}
  />
) 