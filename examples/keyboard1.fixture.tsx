import { InteractiveGraphics } from "graphics-debug/react"
import gkSample95 from "./assets/growing-grid-keyboard-sample-sample95-unrouted_simple_route.json"
import { CapacityMeshSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshSolver"
import type { SimpleRouteJson } from "lib/types"

export default () => {
  const solver = new CapacityMeshSolver(
    gkSample95 as unknown as SimpleRouteJson,
    {
      capacityDepth: 6,
    },
  )
  solver.solve()
  return <InteractiveGraphics graphics={solver.visualize()} />
}
