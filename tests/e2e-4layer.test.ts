import { expect, test } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import type { SimpleRouteJson } from "../lib/types"
import srj from "./fixtures/simple-4layer.json"
import { convertSrjToGraphicsObject } from "./fixtures/convertSrjToGraphicsObject"

test("should solve 4 layer board", async () => {
  const solver = new CapacityMeshSolver(srj as SimpleRouteJson)
  await solver.solve()
  const result = solver.getOutputSimpleRouteJson()
  expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
    import.meta.path,
  )
})
