import { InteractiveGraphics } from "graphics-debug/react"
import { IntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/IntraNodeSolver"
import { HyperSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/HyperSingleIntraNodeSolver"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { useEffect, useState, useMemo } from "react"
import type { NodeWithPortPoints } from "../types/high-density-types"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { GraphicsObject } from "graphics-debug"

interface HyperHighDensityDebuggerProps {
  nodeWithPortPoints: NodeWithPortPoints
  colorMap?: Record<string, string>
}

export const HyperHighDensityDebugger = ({
  nodeWithPortPoints,
  colorMap,
}: HyperHighDensityDebuggerProps) => {
  const solver = useMemo(() => {
    return new HyperSingleIntraNodeSolver({
      nodeWithPortPoints,
      colorMap:
        colorMap ?? generateColorMapFromNodeWithPortPoints(nodeWithPortPoints),
    })
  }, [nodeWithPortPoints])

  const [tab, setTab] = useState<number>(0)
  const [iters, setIters] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      if (solver.solved || solver.failed) {
        clearInterval(interval)
        return
      }
      solver.step()
      if (solver.iterations % 100 === 0) {
        const bestFitnessSolver = solver.getSupervisedSolverWithBestFitness()
        if (bestFitnessSolver) {
          setTab(solver.supervisedSolvers?.indexOf(bestFitnessSolver) ?? 0)
        }
      }
      setIters(solver.iterations)
    }, 10)
    return () => clearInterval(interval)
  }, [solver])

  useEffect(() => {
    if (!solver.solved) return
    const bestFitnessSolver = solver.getSupervisedSolverWithBestFitness()
    if (bestFitnessSolver) {
      setTab(solver.supervisedSolvers?.indexOf(bestFitnessSolver) ?? 0)
    }
  }, [solver.solved])

  let graphics: GraphicsObject | null
  const focusedSolver = solver.supervisedSolvers?.[tab]?.solver
  if (!focusedSolver) {
    graphics = null
  } else if (focusedSolver.failed) {
    graphics = combineVisualizations(
      focusedSolver.visualize(),
      focusedSolver.failedSubSolvers?.[0]?.visualize()!,
    )
  } else {
    graphics = combineVisualizations(
      focusedSolver.visualize(),
      focusedSolver.activeSubSolver?.visualize()!,
    )
  }

  return (
    <div className="p-1">
      <div>
        {solver.supervisedSolvers?.map((supervisedSolver, index) => (
          <button
            key={`solver-${index}-${supervisedSolver.solver.iterations}`}
            onClick={() => setTab(index)}
            className={`border border-gray-300 py-1 px-2 m-1 ${
              index === tab ? "bg-gray-200" : ""
            }`}
          >
            {index}
            {supervisedSolver.solver.solved ? "*" : ""}
          </button>
        ))}
      </div>

      {graphics && <InteractiveGraphics graphics={graphics} />}

      <div>
        <table>
          <thead>
            <tr>
              <th>variant</th>
              <th style={{ fontVariantNumeric: "tabular-nums" }}>
                iterations ({iters})
              </th>
              <th>progress</th>
              <th>subsolver progress</th>
              <th>unsolved routes</th>
              <th>solved routes</th>
              <th>hyper params</th>
            </tr>
          </thead>
          <tbody>
            {solver.supervisedSolvers?.map((supervisedSolver, index) => (
              <tr key={`row-${index}-${supervisedSolver.solver.iterations}`}>
                <td
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    backgroundColor:
                      tab === index ? "rgba(0,0,0,0.1)" : undefined,
                  }}
                >
                  {index}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {supervisedSolver.solver.iterations}
                </td>
                <td
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    backgroundColor: supervisedSolver.solver.failed
                      ? "red"
                      : supervisedSolver.solver.solved
                        ? "lightgreen"
                        : undefined,
                  }}
                >
                  {supervisedSolver.solver.progress?.toFixed(3)}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {/* @ts-ignore */}
                  {supervisedSolver.solver?.activeSolver?.progress?.toFixed(3)}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {/* @ts-ignore */}
                  {supervisedSolver.solver?.unsolvedConnections?.length}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {supervisedSolver.solver.solvedRoutes?.length}
                </td>
                <td>
                  <details>
                    <summary>hyper params</summary>
                    <pre>
                      {JSON.stringify(
                        supervisedSolver.hyperParameters,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
