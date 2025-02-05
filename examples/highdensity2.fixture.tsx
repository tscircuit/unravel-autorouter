import React from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { SingleIntraNodeRouteSolver } from "../lib/solvers/HighDensitySolver/SingleIntraNodeRouteSolver"

const nodeWithPortPoints = {
  capacityMeshNodeId: "node1",
  portPoints: [
    { connectionName: "A", x: 20, y: 0 },
    { connectionName: "A", x: 80, y: 100 },
    { connectionName: "B", x: 50, y: 0 },
    { connectionName: "B", x: 0, y: 100 },
  ],
}

export default () => {
  const solver = new SingleIntraNodeRouteSolver({
    nodeWithPortPoints,
    colorMap: { test: "green" },
  })

  solver.solve()

  const graphics =
    solver.solvedRoutes.length > 0 ? solver.visualize() : { lines: [] }

  return <InteractiveGraphics graphics={graphics} />
}
