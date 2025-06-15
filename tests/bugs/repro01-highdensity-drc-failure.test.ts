import { test, expect } from "bun:test"
import { SingleTransitionCrossingRouteSolver } from "lib/solvers/HighDensitySolver/TwoRouteHighDensitySolver/SingleTransitionCrossingRouteSolver"
import { convertToCircuitJson } from "lib/testing/utils/convertToCircuitJson"
import { checkEachPcbTraceNonOverlapping } from "@tscircuit/checks"
import node from "../../examples/assets/cn11081-nodeWithPortPoints.json" assert {
  type: "json",
}
import { createSrjFromNodeWithPortPoints } from "lib/utils/createSrjFromNodeWithPortPoints"

const nodeWithPortPoints = (node as any).nodeWithPortPoints

test("cn11081 single transition solver routes without DRC errors", () => {
  const srj = createSrjFromNodeWithPortPoints(nodeWithPortPoints)
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

  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "center": {
          "x": -2.56875,
          "y": 10.56785576923077,
        },
        "error_type": "pcb_trace_error",
        "message": "PCB trace trace[trace_0] overlaps with pcb_via "pcb_via[#via_0]" (gap: 0.000mm)",
        "pcb_component_ids": [],
        "pcb_port_ids": [],
        "pcb_trace_error_id": "overlap_trace_0_via_0",
        "pcb_trace_id": "trace_0",
        "source_trace_id": "",
        "type": "pcb_trace_error",
      },
      {
        "center": {
          "x": -2.4107728716233803,
          "y": 10.680042315540916,
        },
        "error_type": "pcb_trace_error",
        "message": "PCB trace trace[trace_0] overlaps with trace[trace_1] (accidental contact)",
        "pcb_component_ids": [],
        "pcb_port_ids": [],
        "pcb_trace_error_id": "overlap_trace_0_trace_1",
        "pcb_trace_id": "trace_0",
        "source_trace_id": "",
        "type": "pcb_trace_error",
      },
    ]
  `)

  expect(errors.length).toBe(0)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
  expect(solverName).toMatchInlineSnapshot(
    `"SingleTransitionCrossingRouteSolver"`,
  )
})
