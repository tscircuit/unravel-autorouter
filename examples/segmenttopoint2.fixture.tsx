import { InteractiveGraphics } from "graphics-debug/react"
import { CapacitySegmentToPointSolver } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import { CapacitySegmentPointOptimizer } from "lib/solvers/CapacitySegmentPointOptimizer/CapacitySegmentPointOptimizer"
import inputs from "./assets/segmenttopoint1.json"
import { useEffect, useMemo, useReducer, useState } from "react"
import { combineVisualizations } from "lib/utils/combineVisualizations"

const initialPointSolver = new CapacitySegmentToPointSolver(
  JSON.parse(JSON.stringify(inputs)),
)
initialPointSolver.solve()

export default () => {
  const [pressCount, incPressCount] = useReducer((p) => p + 1, 0)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())

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

  const highestFailureNodes = useMemo(() => {
    return Object.entries(optimizer.currentNodeCosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [optimizer.currentNodeCosts])

  const highlightVisualization = useMemo(() => {
    if (selectedNodeIds.size === 0) return { rects: [] }
    return {
      rects: Array.from(selectedNodeIds).map((nodeId) => {
        const node = optimizer.nodeMap.get(nodeId)!
        return {
          center: node.center,
          width: node.width,
          height: node.height,
          color: "rgba(255, 0, 0, 0.3)",
          stroke: "red",
          strokeWidth: 2,
        }
      }),
    }
  }, [selectedNodeIds])

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  return (
    <div>
      <div>
        <button className="border rounded-md p-2" onClick={incPressCount}>
          Step
        </button>
      </div>
      <div className="flex gap-2">
        <div>Iterations: {optimizer.iterations}</div>
        <div>
          P(failure) {(optimizer.probabilityOfFailure * 100).toFixed(8)}%
        </div>
        <div>cost {optimizer.currentCost.toFixed(10)}</div>
      </div>
      <InteractiveGraphics
        graphics={combineVisualizations(
          optimizer.visualize(),
          highlightVisualization,
        )}
      />
      <div className="mt-4 flex">
        <div>
          <h3 className="font-bold">Highest Failure Risk Nodes</h3>
          <table className="border-collapse border">
            <thead>
              <tr>
                <th className="border p-2">Highlight</th>
                <th className="border p-2">Node ID</th>
                <th className="border p-2">P(Failure)</th>
              </tr>
            </thead>
            <tbody>
              {highestFailureNodes.map(([nodeId, cost]) => (
                <tr key={nodeId}>
                  <td className="border p-2">
                    <input
                      type="checkbox"
                      checked={selectedNodeIds.has(nodeId)}
                      onChange={() => toggleNodeSelection(nodeId)}
                    />
                  </td>
                  <td className="border p-2">{nodeId}</td>
                  <td className="border p-2">{(cost * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
