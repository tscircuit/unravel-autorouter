import { expect, test } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import type { SimpleRouteJson } from "lib/types"
import { convertSrjToGraphicsObject } from "./fixtures/convertSrjToGraphicsObject"
import e2e4layer from "../examples/assets/e2e4layer.json"

// Simple end-to-end test for 4 layer routing

test("should solve a 4-layer board", async () => {
  const srj: SimpleRouteJson = e2e4layer as any
  const solver = new CapacityMeshSolver(srj)
  await solver.solve()
  const result = solver.getOutputSimpleRouteJson()
  expect(result.layerCount).toBe(4)
  expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
    import.meta.path,
  )
})
