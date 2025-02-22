import { InteractiveGraphics } from "graphics-debug/react"
import { SingleIntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/SingleIntraNodeRouteSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { useState, useRef, useEffect } from "react"
import type { NodeWithPortPoints } from "../types/high-density-types"
import { HighDensityHyperParameters } from "lib/solvers/HighDensitySolver/HighDensityHyperParameters"

interface HighDensityDebuggerProps {
  nodeWithPortPoints: NodeWithPortPoints
  hyperParameters?: Partial<HighDensityHyperParameters>
}

export const HighDensityDebugger = ({
  nodeWithPortPoints,
  hyperParameters = {},
}: HighDensityDebuggerProps) => {
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [maxSolvedRoutes, setMaxSolvedRoutes] = useState(0)
  const [bestSeed, setBestSeed] = useState(0)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (isAnimating) {
      const animate = () => {
        setShuffleSeed(Math.floor(Math.random() * 1000000))
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isAnimating])

  const solver = new SingleIntraNodeRouteSolver({
    nodeWithPortPoints,
    colorMap: generateColorMapFromNodeWithPortPoints(nodeWithPortPoints),
    hyperParameters: {
      ...hyperParameters,
      SHUFFLE_SEED: shuffleSeed,
    },
  })

  solver.solve()

  const solvedCount = solver.solvedRoutes.length

  useEffect(() => {
    if (solvedCount > maxSolvedRoutes) {
      setMaxSolvedRoutes(solvedCount)
      setBestSeed(shuffleSeed)

      // Stop animation if all connections are solved
      if (solvedCount === solver.totalConnections) {
        setIsAnimating(false)
      }
    }
  }, [solvedCount, shuffleSeed, solver.totalConnections])

  const graphics =
    solver.solvedRoutes.length > 0 ? solver.visualize() : { lines: [] }

  if (solver.failedSolvers.length > 0) {
    return (
      <div>
        <div className="border p-2 m-2 text-center font-bold">
          {solver.solvedRoutes.length} / {solver.totalConnections}
        </div>
        <div className="border p-2 m-2 text-center">
          Max Solved: {maxSolvedRoutes} (Seed: {bestSeed})
        </div>
        <button
          className="border p-2 m-2"
          onClick={() => setShuffleSeed(shuffleSeed + 1)}
        >
          Next Seed
        </button>
        <button
          className="border p-2 m-2"
          onClick={() => setShuffleSeed(Math.floor(Math.random() * 1000))}
        >
          Shuffle (Current Seed: {shuffleSeed})
        </button>
        <button
          className="border p-2 m-2"
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? "Stop" : "Start"} Animation
        </button>
        <InteractiveGraphics
          graphics={combineVisualizations(
            solver.failedSolvers[0].visualize(),
            solver.visualize(),
          )}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="border p-2 m-2 text-center">
        Max Solved: {maxSolvedRoutes} (Seed: {bestSeed})
      </div>
      <button
        className="border p-2 m-2"
        onClick={() => setShuffleSeed(shuffleSeed + 1)}
      >
        Shuffle (Current Seed: {shuffleSeed})
      </button>
      <button
        className="border p-2 m-2"
        onClick={() => setIsAnimating(!isAnimating)}
      >
        {isAnimating ? "Stop" : "Start"} Animation
      </button>
      <InteractiveGraphics graphics={graphics} />
    </div>
  )
}
