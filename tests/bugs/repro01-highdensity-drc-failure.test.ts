import { test, expect } from "bun:test"
import { SingleTransitionCrossingRouteSolver } from "lib/solvers/HighDensitySolver/TwoRouteHighDensitySolver/SingleTransitionCrossingRouteSolver"
import { convertToCircuitJson } from "lib/testing/utils/convertToCircuitJson"
import { checkEachPcbTraceNonOverlapping } from "@tscircuit/checks"
import node from "../../examples/assets/cn11081-nodeWithPortPoints.json" assert {
  type: "json",
}

const nodeWithPortPoints = (node as any).nodeWithPortPoints

test("cn11081 single transition solver routes without DRC errors", () => {
  const srj = createSrjFromNode(node)
  const solver = new SingleTransitionCrossingRouteSolver({ nodeWithPortPoints })

  solver.solve()

  expect(solver.solved).toBe(true)

  const solverName = solver.constructor.name

  // Convert routes to circuit json and run DRC
  const circuitJson = convertToCircuitJson(
    srj,
    solver.solvedRoutes,
    srj.minTraceWidth,
  )
  const errors = checkEachPcbTraceNonOverlapping(circuitJson)

  expect(errors.length).toBe(0)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
  expect(solverName).toMatchInlineSnapshot(
    `"SingleTransitionCrossingRouteSolver"`,
  )
})
