import { InteractiveGraphics } from "graphics-debug/react"
import { CapacitySegmentToPointSolver } from "lib/solvers/CapacityMeshSolver/CapacitySegmentToPointSolver"
import { CapacitySegmentPointOptimizer } from "lib/solvers/CapacitySegmentPointOptimizer/CapacitySegmentPointOptimizer"
import inputs from "./assets/segmenttopoint1.json"
import { useEffect, useMemo, useReducer, useState, useCallback } from "react"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const initialPointSolver = new CapacitySegmentToPointSolver(
  JSON.parse(JSON.stringify(inputs)),
)
initialPointSolver.solve()

export default () => {
  const [pressCount, incPressCount] = useReducer((p) => p + 1, 0)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    let intervalId: number | undefined
    if (isAnimating) {
      intervalId = window.setInterval(() => {
        incPressCount()
      }, 10)
    }
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId)
      }
    }
  }, [isAnimating])

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
    return [...optimizer.currentNodeCosts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [optimizer.currentNodeCosts])

  const nodeCostsSorted = [...optimizer.currentNodeCosts.values()].sort()

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
      <div className="flex gap-2">
        <button className="border rounded-md p-2" onClick={incPressCount}>
          Step
        </button>
        <button
          className="border rounded-md p-2"
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? "Stop" : "Animate"}
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
        <div className="w-full h-96 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={nodeCostsSorted.map((n, i) => ({
                index: i,
                value: n,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="index"
                label={{ value: "Index", position: "bottom", offset: 0 }}
              />
              <YAxis label={{ value: "Value", angle: -90, position: "left" }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: "#2563eb" }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
