import { test, expect } from "bun:test"
import { SingleTransitionCrossingRouteSolver } from "lib/solvers/HighDensitySolver/TwoRouteHighDensitySolver/SingleTransitionCrossingRouteSolver"
import { convertToCircuitJson } from "lib/testing/utils/convertToCircuitJson"
import { checkEachPcbTraceNonOverlapping } from "@tscircuit/checks"
import "graphics-debug/matcher"
import node from "../../examples/assets/cn11081-nodeWithPortPoints.json" assert {
  type: "json",
}

const nodeWithPortPoints = (node as any).nodeWithPortPoints

function createSrjFromNode(node: any) {
  const bounds = node.capacityMeshNode
  return {
    layerCount: 2,
    minTraceWidth: 0.1,
    obstacles: [],
    connections: [
      {
        name: "source_trace_76",
        pointsToConnect: [
          { x: -2.21875, y: 10.81640625, layer: "top" },
          { x: -2.21875, y: 9.70703125, layer: "bottom" },
        ],
      },
      {
        name: "source_net_0_mst22",
        pointsToConnect: [
          { x: -2.21875, y: 10.26171875, layer: "top" },
          { x: -3.328125, y: 11.09375, layer: "top" },
        ],
      },
    ],
    bounds: {
      minX: bounds.center.x - bounds.width / 2,
      maxX: bounds.center.x + bounds.width / 2,
      minY: bounds.center.y - bounds.height / 2,
      maxY: bounds.center.y + bounds.height / 2,
    },
  }
}

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
