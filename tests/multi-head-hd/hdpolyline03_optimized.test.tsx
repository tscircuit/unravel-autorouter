import { test, expect } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver2 } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver2_Optimized"
import cn9630 from "examples/assets/cn9630-nodeWithPortPoints.json"
import "graphics-debug/matcher"

test("hdpolyline03_optimized", () => {
  const solver = new MultiHeadPolyLineIntraNodeSolver2({
    nodeWithPortPoints: cn9630.nodeWithPortPoints,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
