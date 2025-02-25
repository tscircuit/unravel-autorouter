import { InteractiveGraphics } from "graphics-debug/react"
import { SingleIntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/SingleIntraNodeRouteSolver"
import { HyperSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/HyperSingleIntraNodeSolver"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { useEffect, useState, useMemo } from "react"
import type { NodeWithPortPoints } from "../types/high-density-types"
import { combineVisualizations } from "lib/utils/combineVisualizations"

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

  const [tab, setTab] = useState<number | undefined>(undefined)
  const [iters, setIters] = useState(0)
  const [focusedSolver, setFocusedSolver] =
    useState<SingleIntraNodeRouteSolver | null>(null)

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
          setFocusedSolver(bestFitnessSolver.solver)
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
      setFocusedSolver(bestFitnessSolver.solver)
    }
  }, [solver.solved])

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

      <div className="flex">
        {focusedSolver && (
          <InteractiveGraphics
            graphics={
              focusedSolver.failed && focusedSolver.failedSolvers.length > 0
                ? combineVisualizations(
                    focusedSolver.visualize(),
                    focusedSolver.failedSolvers[0].visualize(),
                  )
                : focusedSolver.visualize()
            }
          />
        )}
        {tab !== undefined && (
          <InteractiveGraphics
            graphics={
              solver.supervisedSolvers?.[tab]?.solver.failed &&
              solver.supervisedSolvers?.[tab]?.solver.failedSolvers.length > 0
                ? combineVisualizations(
                    solver.supervisedSolvers[tab].solver.visualize(),
                    solver.supervisedSolvers[
                      tab
                    ].solver.failedSolvers[0].visualize(),
                  )
                : (solver.supervisedSolvers?.[tab]?.solver.visualize() ?? {})
            }
          />
        )}
      </div>

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
                  {supervisedSolver.solver?.activeSolver?.progress?.toFixed(3)}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {supervisedSolver.solver.unsolvedConnections.length}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {supervisedSolver.solver.solvedRoutes.length}
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
