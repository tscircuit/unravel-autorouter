import { InteractiveGraphics } from "graphics-debug/react"
import gkSample95 from "./assets/growing-grid-keyboard-sample-sample95-unrouted_simple_route.json"
import { CapacityMeshSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshSolver"
import type { SimpleRouteJson } from "lib/types"
import { useState } from "react"

export default () => {
  const [solver] = useState(
    () =>
      new CapacityMeshSolver(gkSample95 as unknown as SimpleRouteJson, {
        capacityDepth: 6,
      }),
  )
  const [, forceUpdate] = useState({})
  const failedHdSolvers = solver.highDensityRouteSolver?.failedSolvers

  const animateToNextSolver = () => {
    const currentSolver = solver.activeSolver
    const interval = setInterval(() => {
      solver.step()
      forceUpdate({})
      if (!solver.activeSolver || solver.activeSolver !== currentSolver) {
        clearInterval(interval)
      }
    }, 10)
  }

  const animateUntilSolved = () => {
    const interval = setInterval(() => {
      solver.step()
      forceUpdate({})
      if (solver.solved || solver.failed) {
        clearInterval(interval)
      }
    }, 10)
  }

  return (
    <>
      <div className="border p-1 m-1">Iterations {solver.iterations}</div>
      <button
        className="border m-2 p-2"
        onClick={() => {
          solver.step()
          forceUpdate({})
        }}
      >
        Step
      </button>
      <button className="border m-2 p-2" onClick={animateToNextSolver}>
        Animate to next solver
      </button>
      <button className="border m-2 p-2" onClick={animateUntilSolved}>
        Animate until solved
      </button>
      <InteractiveGraphics graphics={solver.visualize()} />
      {failedHdSolvers?.map((s) => (
        <button
          className="border m-2 p-2"
          key={s.nodeWithPortPoints.capacityMeshNodeId}
          onClick={() => {
            const json = JSON.stringify({
              nodeWithPortPoints: s.nodeWithPortPoints,
            })
            navigator.clipboard.writeText(json)
            alert("Copied to clipboard")
          }}
        >
          {s.nodeWithPortPoints.capacityMeshNodeId}
        </button>
      ))}
    </>
  )
}
