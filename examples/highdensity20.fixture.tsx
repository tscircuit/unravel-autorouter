import { InteractiveGraphics } from "graphics-debug/react"
import { SingleIntraNodeRouteSolver } from "lib/solvers/HighDensitySolver/SingleIntraNodeRouteSolver"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import cn4046 from "./assets/nodeWithPortPoints_cn4046.json"

export default () => {
  const solver = new SingleIntraNodeRouteSolver({
    nodeWithPortPoints: cn4046.nodeWithPortPoints,
    colorMap: generateColorMapFromNodeWithPortPoints(cn4046.nodeWithPortPoints),
    hyperParameters: {},
  })

  solver.solve()

  const graphics =
    solver.solvedRoutes.length > 0 ? solver.visualize() : { lines: [] }

  if (solver.failedSolvers.length > 0) {
    return (
      <div>
        <div className="border p-2 m-2 text-center font-bold">
          {solver.solvedRoutes.length} / {solver.totalConnections}
        </div>
        <InteractiveGraphics
          graphics={combineVisualizations(
            solver.failedSolvers[0].visualize(),
            solver.visualize(),
          )}
        />
      </div>
    )
  }

  return <InteractiveGraphics graphics={graphics} />
}
