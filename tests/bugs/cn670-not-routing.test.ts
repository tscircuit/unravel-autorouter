import { test, expect } from "bun:test"
import { HyperSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/HyperSingleIntraNodeSolver"
import cn670 from "../../examples/assets/cn670-nodeWithPortPoints.json"
import "graphics-debug/matcher"

const nodeWithPortPoints = (cn670 as any).nodeWithPortPoints

test.skip("cn670 routes successfully", () => {
  const solver = new HyperSingleIntraNodeSolver({ nodeWithPortPoints })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.error).toBe(null)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
