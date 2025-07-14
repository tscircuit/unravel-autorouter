import { test, expect } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import { SimpleRouteJson } from "lib/types"
import { convertSrjToGraphicsObject } from "./fixtures/convertSrjToGraphicsObject"

test("routes simple 4 layer board", async () => {
  const srj: SimpleRouteJson = {
    layerCount: 4,
    minTraceWidth: 0.15,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 5 },
        width: 1,
        height: 10,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["bottom"],
        center: { x: 4, y: 5 },
        width: 1,
        height: 10,
        connectedTo: [],
      },
    ],
    connections: [
      {
        name: "conn1",
        pointsToConnect: [
          { x: 1, y: 5, layer: "top" },
          { x: 9, y: 5, layer: "bottom" },
        ],
      },
    ],
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
  }

  const solver = new CapacityMeshSolver(srj)
  await solver.solve()
  const result = solver.getOutputSimpleRouteJson()

  expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
    import.meta.path,
  )
})
