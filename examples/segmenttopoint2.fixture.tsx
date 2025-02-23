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
    optimizer.step()
    return { initialPointSolver, optimizer }
  }, [])

  return (
    <div>
      <div className="flex gap-2">
        <div>Iterations: {optimizer.iterations}</div>
        <div>Probability of Failure {optimizer.currentCost.toFixed(8)}</div>
      </div>
      <InteractiveGraphics
        graphics={combineVisualizations(
          // initialPointSolver.visualize(),
          optimizer.visualize(),
        )}
      />
    </div>
  )
}
