import { useState, useEffect, useMemo } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { BaseSolver } from "lib/solvers/BaseSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"

interface GenericSolverDebuggerProps {
  createSolver: () => BaseSolver
  animationSpeed?: number
}

export const GenericSolverDebugger = ({
  createSolver,
  animationSpeed = 100,
}: GenericSolverDebuggerProps) => {
  const [solver, setSolver] = useState<BaseSolver>(() => createSolver())
  const [isAnimating, setIsAnimating] = useState(false)
  const [fastAnimation, setFastAnimation] = useState(false)
  const [iterationCount, setIterationCount] = useState(0)

  // Reset solver
  const resetSolver = () => {
    setSolver(createSolver())
    setIterationCount(0)
  }

  // Animation effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined

    if (isAnimating && !solver.solved && !solver.failed) {
      intervalId = setInterval(() => {
        const stepsPerInterval = fastAnimation ? 100 : 1

        for (let i = 0; i < stepsPerInterval; i++) {
          if (solver.solved || solver.failed) {
            break
          }
          solver.step()
        }

        setIterationCount(solver.iterations)
      }, animationSpeed)
    }

    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId)
      }
    }
  }, [isAnimating, fastAnimation, solver, animationSpeed])

  // Manual step function
  const handleStep = () => {
    if (!solver.solved && !solver.failed) {
      solver.step()
      setIterationCount(solver.iterations)
    }
  }

  // Solve completely
  const handleSolveCompletely = () => {
    if (!solver.solved && !solver.failed) {
      solver.solve()
      setIterationCount(solver.iterations)
    }
  }

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    return (solver.iterations / solver.MAX_ITERATIONS) * 100
  }, [solver.iterations, solver.MAX_ITERATIONS])

  // Safely get visualization
  const visualization = useMemo(() => {
    try {
      return solver?.visualize() || { points: [], lines: [] }
    } catch (error) {
      console.error("Visualization error:", error)
      return { points: [], lines: [] }
    }
  }, [solver, solver.iterations])

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button
          className="border rounded-md p-2 hover:bg-gray-100"
          onClick={handleStep}
          disabled={solver.solved || solver.failed}
        >
          Step
        </button>
        <button
          className="border rounded-md p-2 hover:bg-gray-100"
          onClick={() => setIsAnimating(!isAnimating)}
          disabled={solver.solved || solver.failed}
        >
          {isAnimating ? "Stop" : "Animate"}
        </button>
        <button
          className="border rounded-md p-2 hover:bg-gray-100"
          onClick={() => {
            setIsAnimating(true)
            setFastAnimation(!fastAnimation)
          }}
          disabled={solver.solved || solver.failed}
        >
          {isAnimating ? (fastAnimation ? "Slow" : "Fast") : "Animate Fast"}
        </button>
        <button
          className="border rounded-md p-2 hover:bg-gray-100"
          onClick={handleSolveCompletely}
          disabled={solver.solved || solver.failed}
        >
          Solve Completely
        </button>
        <button
          className="border rounded-md p-2 hover:bg-gray-100"
          onClick={resetSolver}
        >
          Reset
        </button>
      </div>

      <div className="flex gap-4 mb-4 tabular-nums">
        <div className="border p-2 rounded">
          Iterations: <span className="font-bold">{iterationCount}</span>
        </div>
        <div className="border p-2 rounded">
          Completion:{" "}
          <span className="font-bold">{completionPercentage.toFixed(2)}%</span>
        </div>
        <div className="border p-2 rounded">
          Status:{" "}
          <span
            className={`font-bold ${solver.solved ? "text-green-600" : solver.failed ? "text-red-600" : "text-blue-600"}`}
          >
            {solver.solved ? "Solved" : solver.failed ? "Failed" : "Running"}
          </span>
        </div>
        {solver.error && (
          <div className="border p-2 rounded bg-red-100">
            Error: <span className="font-bold">{solver.error}</span>
          </div>
        )}
      </div>

      <div className="border rounded-md p-4 mb-4">
        <InteractiveGraphics graphics={visualization} />
      </div>

      <div className="mt-4 border-t pt-4">
        <h3 className="font-bold mb-2">Solver Information</h3>
        <div className="border p-2 rounded mb-2">
          Type: <span className="font-bold">{solver.constructor.name}</span>
        </div>
        <div className="border p-2 rounded mb-2">
          Max Iterations:{" "}
          <span className="font-bold">{solver.MAX_ITERATIONS}</span>
        </div>
      </div>
    </div>
  )
}
