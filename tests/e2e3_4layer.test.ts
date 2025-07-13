import { expect, test } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import type { SimpleRouteJson } from "lib/types"
import { convertSrjToGraphicsObject } from "./fixtures/convertSrjToGraphicsObject"

test("routes a simple 4-layer board", () => {
  const srj: SimpleRouteJson = {
    layerCount: 4,
    minTraceWidth: 0.15,
    obstacles: [],
    connections: [
      {
        name: "conn1",
        pointsToConnect: [
          { x: 1, y: 1, layer: "top" },
          { x: 9, y: 9, layer: "bottom" },
        ],
      },
      {
        name: "conn2",
        pointsToConnect: [
          { x: 1, y: 9, layer: "top" },
          { x: 9, y: 1, layer: "bottom" },
        ],
      },
    ],
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
  }

  const solver = new CapacityMeshSolver(srj)
  solver.solve()
  const result = solver.getOutputSimpleRouteJson()

  expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
    import.meta.path,
  )
})
