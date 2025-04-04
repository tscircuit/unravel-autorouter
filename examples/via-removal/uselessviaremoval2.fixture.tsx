import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { UselessViaRemovalSolver } from "lib/solvers/UselessViaRemovalSolver/UselessViaRemovalSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

// Create a test case with three routes that intersect at a single point
// Initially all routes use vias, but some can be optimized away
const createSolver = () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      // Horizontal route
      connectionName: "route1",
      route: [
        { x: 0, y: 50, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 100, y: 50, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
    {
      // Vertical route
      connectionName: "route2",
      route: [
        { x: 50, y: 0, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 50, y: 100, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
    {
      // Diagonal route
      connectionName: "route3",
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 100, y: 100, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
    route2: "#00ff00",
    route3: "#0000ff",
  }

  return new UselessViaRemovalSolver({ routes, colorMap })
}

// The solver should optimize this by keeping at least one route on layer 0
// and minimizing the total number of vias needed for the crossing routes
export default () => (
  <GenericSolverDebugger
    createSolver={createSolver}
    animationSpeed={500}
  />
) 