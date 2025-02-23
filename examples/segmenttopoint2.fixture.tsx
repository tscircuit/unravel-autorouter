import { InteractiveGraphics } from "graphics-debug/react"
import { CapacitySegmentToPointSolver } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import { CapacitySegmentPointOptimizer } from "lib/solvers/CapacitySegmentPointOptimizer/CapacitySegmentPointOptimizer"
import inputs from "./assets/segmenttopoint1.json"
import { useMemo } from "react"
import { combineVisualizations } from "lib/utils/combineVisualizations"

export default () => {
  const { initialPointSolver, optimizer } = useMemo(() => {
    const initialPointSolver = new CapacitySegmentToPointSolver(inputs)
    initialPointSolver.solve()
    const optimizer = new CapacitySegmentPointOptimizer({
      assignedSegments: initialPointSolver.solvedSegments,
      colorMap: initialPointSolver.colorMap,
      nodes: inputs.nodes,
    })
    return { initialPointSolver, optimizer }
  }, [])

  return (
    <InteractiveGraphics
      graphics={combineVisualizations(
        // initialPointSolver.visualize(),
        optimizer.visualize(),
      )}
    />
  )
}
