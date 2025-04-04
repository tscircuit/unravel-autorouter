import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { UselessViaRemovalSolver } from "lib/solvers/UselessViaRemovalSolver/UselessViaRemovalSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

// Create a simple test case with two routes that cross each other
// Initially both routes use vias to avoid each other, but one could stay on its layer
const createSolver = () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      // Route 1: Goes from (10,10) to (90,90), initially using a via at (50,50)
      connectionName: "route1",
      route: [
        { x: 10, y: 10, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 90, y: 90, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
    {
      // Route 2: Goes from (10,90) to (90,10), using a via at (50,50)
      connectionName: "route2",
      route: [
        { x: 10, y: 90, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 90, y: 10, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
    route2: "#0000ff",
  }

  return new UselessViaRemovalSolver({ routes, colorMap })
}

// The solver should optimize this by keeping one route on layer 0
// and letting the other route use vias to cross over it
export default () => (
  <GenericSolverDebugger
    createSolver={createSolver}
    animationSpeed={500}
  />
) 