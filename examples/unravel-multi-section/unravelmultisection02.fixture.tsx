import { UnravelSectionSolver } from "lib/solvers/UnravelSolver/UnravelSectionSolver"
import UnravelSectionDebugger from "lib/testing/UnravelSectionDebugger"
import unravelmultisection02 from "examples/assets/unravelmultisection02.json"
import { getDedupedSegments } from "lib/solvers/UnravelSolver/getDedupedSegments"
import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { SegmentId } from "lib/solvers/UnravelSolver/types"
import { GenericSolverDebugger } from "lib/testing/GenericSolverDebugger"
import { UnravelMultiSectionSolver } from "lib/solvers/UnravelSolver/UnravelMultiSectionSolver"

export default function UnravelMultiSection01() {
  return (
    <GenericSolverDebugger
      createSolver={() => {
        const solver = new UnravelMultiSectionSolver({
          assignedSegments: unravelmultisection02.assignedSegments,
          nodes: unravelmultisection02.nodes as CapacityMeshNode[],
          colorMap: unravelmultisection02.colorMap,
        })

        return solver
      }}
    />
  )
}
