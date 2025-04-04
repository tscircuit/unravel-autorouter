import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { UselessViaRemovalSolver } from "lib/solvers/UselessViaRemovalSolver/UselessViaRemovalSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

// Create a test case similar to the image with an L-shaped route that has an unnecessary layer change
const createSolver = () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      // An L-shaped route with an unnecessary layer change
      connectionName: "route1",
      route: [
        { x: 10, y: 90, z: 0 },  // Starting point
        { x: 50, y: 90, z: 0 },  // Horizontal segment
        { x: 50, y: 90, z: 1 },  // Unnecessary layer change
        { x: 50, y: 50, z: 1 },  // Vertical segment
      ],
      vias: [{ x: 50, y: 90 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  // Add some obstacle rectangles for visualization
  const obstacles: HighDensityIntraNodeRoute[] = [
    {
      // Red obstacle rectangle
      connectionName: "obstacle1",
      route: [
        { x: 20, y: 20, z: 0 },
        { x: 80, y: 20, z: 0 },
        { x: 80, y: 40, z: 0 },
        { x: 20, y: 40, z: 0 },
        { x: 20, y: 20, z: 0 },
      ],
      vias: [],
      traceThickness: 2,
      viaDiameter: 0,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
    obstacle1: "#ff0000",
  }

  return new UselessViaRemovalSolver({ routes: [...routes, ...obstacles], colorMap })
}

// The solver should optimize this by removing the via and keeping the route on layer 0
export default () => (
  <GenericSolverDebugger
    createSolver={createSolver}
    animationSpeed={500}
  />
) 