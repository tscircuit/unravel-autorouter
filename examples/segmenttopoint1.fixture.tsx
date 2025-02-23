import { InteractiveGraphics } from "graphics-debug/react"
import { CapacitySegmentToPointSolver } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import inputs from "./assets/segmenttopoint1.json"

export default () => {
  const solver = new CapacitySegmentToPointSolver(inputs)

  solver.solve()

  return <InteractiveGraphics graphics={solver.visualize()} />
}
