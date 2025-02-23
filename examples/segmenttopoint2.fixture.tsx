import { InteractiveGraphics } from "graphics-debug/react"
import { CapacitySegmentToPointSolver } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import { CapacitySegmentPointOptimizer } from "lib/solvers/CapacitySegmentPointOptimizer/CapacitySegmentPointOptimizer"
import inputs from "./assets/segmenttopoint1.json"
import { useEffect, useMemo, useReducer } from "react"
import { combineVisualizations } from "lib/utils/combineVisualizations"

const initialPointSolver = new CapacitySegmentToPointSolver(
  JSON.parse(JSON.stringify(inputs)),
)
initialPointSolver.solve()

export default () => {
  const [pressCount, incPressCount] = useReducer((p) => p + 1, 0)
  const { optimizer } = useMemo(() => {
    const optimizer = new CapacitySegmentPointOptimizer({
      assignedSegments: initialPointSolver.solvedSegments,
      colorMap: initialPointSolver.colorMap,
      nodes: inputs.nodes,
    })
    // optimizer.step()
    return { optimizer }
  }, [])

  useEffect(() => {
    if (pressCount === 0) return
    optimizer.step()
  }, [pressCount])

  return (
    <div>
      <div>
        <button className="border rounded-md p-2" onClick={incPressCount}>
          Step
        </button>
      </div>
      <div className="flex gap-2">
        <div>Iterations: {optimizer.iterations}</div>
        <div>Probability of Failure {optimizer.currentCost.toFixed(10)}</div>
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
