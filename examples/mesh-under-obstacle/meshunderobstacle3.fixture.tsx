import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { CapacityMeshNodeSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver1"
import { CapacityMeshNodeSolver2_NodeUnderObstacle } from "lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver2_NodesUnderObstacles"
import { SimpleRouteJson } from "lib/types/srj-types"
import meshunderobstacle1 from "../assets/meshunderobstacle1.json"

export default () => {
  return (
    <GenericSolverDebugger
      createSolver={() => {
        const meshSolver = new CapacityMeshNodeSolver2_NodeUnderObstacle(
          meshunderobstacle1 as SimpleRouteJson,
          {
            capacityDepth: 7,
          },
        )
        return meshSolver
      }}
    />
  )
}
