import { InteractiveGraphics } from "graphics-debug/react"
import gkSample95 from "./assets/growing-grid-keyboard-sample-sample95-unrouted_simple_route.json"
import { CapacityMeshSolver } from "lib/solvers/CapacityMeshSolver/CapacityMeshSolver"
import type { SimpleRouteJson } from "lib/types"
import { useState } from "react"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { NodePortSegment } from "lib/types/capacity-edges-to-port-segments-types"

export default () => {
  const [solver] = useState(
    () =>
      new CapacityMeshSolver(gkSample95 as unknown as SimpleRouteJson, {
        capacityDepth: 7,
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
      for (let i = 0; i < 20; i++) {
        solver.step()
      }
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
      <InteractiveGraphics
        graphics={
          solver.solved || solver.failed
            ? solver.visualize()
            : // Fixes dumb animation bug
              combineVisualizations({}, solver.visualize())
        }
      />
      <p className="border-t mt-2 text-gray-500">Solver Inputs</p>
      {solver.segmentToPointSolver && (
        <button
          className="border m-2 p-2"
          onClick={() => {
            const allSegments = solver.segmentToPointSolver!.solvedSegments
            const inputs = {
              segments: allSegments,
              colorMap: solver.colorMap,
              nodes: solver
                .nodeTargetMerger!.newNodes.map((n) => ({
                  ...n,
                  _parent: undefined,
                }))
                .filter((n) =>
                  allSegments.some(
                    (s) => s.capacityMeshNodeId === n.capacityMeshNodeId,
                  ),
                ),
            }
            navigator.clipboard.writeText(JSON.stringify(inputs))
            alert("Copied to clipboard")
          }}
        >
          Segment to Point Solver
        </button>
      )}
      <p className="border-t mt-2 text-gray-500">
        Failed IntraNode High Density Solvers
      </p>
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
