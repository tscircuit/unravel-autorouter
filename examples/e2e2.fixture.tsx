import { InteractiveGraphics } from "graphics-debug/react"
import { CapacityMeshSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshSolver"
import { SimpleRouteJson } from "lib/types"
import simpleRouteJson from "./assets/e2e2.json"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"

export default () => (
  <GenericSolverDebugger
    createSolver={() => new CapacityMeshSolver(simpleRouteJson as any)}
  />
)
