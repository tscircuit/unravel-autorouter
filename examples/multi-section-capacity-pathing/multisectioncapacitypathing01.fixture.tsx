import { AutoroutingPipelineSolver } from "lib/solvers/AutoroutingPipelineSolver"
import { CapacityPathingMultiSectionSolver } from "lib/solvers/CapacityPathingSectionSolver/CapacityPathingMultiSectionSolver"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import srj from "../assets/multisectioncapacitypathing1.json"
import { AutoroutingPipelineDebugger } from "lib/testing/AutoroutingPipelineDebugger"

export default () => {
  return (
    // <GenericSolverDebugger
    //   createSolver={() => {
    //     const pipeline = new AutoroutingPipelineSolver(srj as any)

    //     // pipeline.solveUntilPhase("pathingSolver")

    //     const solver = new CapacityPathingMultiSectionSolver({
    //       simpleRouteJson: pipeline.srjWithPointPairs!,
    //       nodes: pipeline.capacityNodes!,
    //       edges: pipeline.edgeSolver?.edges || [],
    //       colorMap: pipeline.colorMap,
    //       hyperParameters: {
    //         MAX_CAPACITY_FACTOR: 1,
    //       },
    //     })

    //     return pipeline
    //   }}
    // />
    <AutoroutingPipelineDebugger srj={srj as any} />
  )
}
