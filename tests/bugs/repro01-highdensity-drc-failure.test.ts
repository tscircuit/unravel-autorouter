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

  expect(srj).toMatchInlineSnapshot(`
    {
      "bounds": {
        "maxX": -2.21875,
        "maxY": 11.09375,
        "minX": -4.4375,
        "minY": 8.875,
      },
      "connections": [
        {
          "name": "source_trace_76",
          "pointsToConnect": [
            {
              "layer": "top",
              "x": -2.21875,
              "y": 10.81640625,
            },
            {
              "layer": "bottom",
              "x": -2.21875,
              "y": 9.70703125,
            },
          ],
        },
        {
          "name": "source_net_0_mst22",
          "pointsToConnect": [
            {
              "layer": "top",
              "x": -2.21875,
              "y": 10.26171875,
            },
            {
              "layer": "top",
              "x": -3.328125,
              "y": 11.09375,
            },
          ],
        },
      ],
      "layerCount": 2,
      "minTraceWidth": 0.1,
      "obstacles": [],
    }
  `)

  solver.solve()

  expect(solver.solved).toBe(true)

  const solverName = solver.constructor.name

  // Convert routes to circuit json and run DRC
  const circuitJson = convertToCircuitJson(
    srj,
    solver.solvedRoutes,
    srj.minTraceWidth,
  )
  expect(circuitJson).toMatchInlineSnapshot(`
    [
      {
        "connected_source_net_ids": [],
        "connected_source_port_ids": [],
        "source_trace_id": "source_trace_76",
        "type": "source_trace",
      },
      {
        "connected_source_net_ids": [],
        "connected_source_port_ids": [],
        "source_trace_id": "source_net_0",
        "type": "source_trace",
      },
      {
        "hole_diameter": 0.3,
        "layers": [
          "top",
          "bottom",
        ],
        "outer_diameter": 0.6,
        "pcb_trace_id": "trace_0",
        "pcb_via_id": "via_0",
        "type": "pcb_via",
        "x": -2.86875,
        "y": 10.3548125,
      },
      {
        "pcb_trace_id": "trace_0",
        "route": [
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.21875,
            "y": 10.81640625,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.86875,
            "y": 10.3548125,
          },
          {
            "layer": "bottom",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.86875,
            "y": 10.3548125,
          },
          {
            "layer": "bottom",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.21875,
            "y": 9.70703125,
          },
        ],
        "source_trace_id": "source_trace_76",
        "type": "pcb_trace",
      },
      {
        "pcb_trace_id": "trace_1",
        "route": [
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.21875,
            "y": 10.26171875,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.3409959497238444,
            "y": 10.139462407320398,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.3570385157961606,
            "y": 10.103712207419717,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.375499372571123,
            "y": 10.069148679152804,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.3194292839755555,
            "y": 10.20267193688026,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.298817881734124,
            "y": 10.346015877411102,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.3866752386139307,
            "y": 10.658957078177163,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -2.631293856760419,
            "y": 10.872996424912557,
          },
          {
            "layer": "top",
            "route_type": "wire",
            "width": 0.1,
            "x": -3.328125,
            "y": 11.09375,
          },
        ],
        "source_trace_id": "source_net_0",
        "type": "pcb_trace",
      },
    ]
  `)
  const errors = checkEachPcbTraceNonOverlapping(circuitJson)

  expect(errors).toMatchInlineSnapshot(`
    [
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
