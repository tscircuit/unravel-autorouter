import { test, expect } from "bun:test"
import { HighDensityRouteSolver } from "lib/solvers/HighDensitySolver/HighDensityRouteSolver"

const inputs = {
  nodePortPoints: [
    {
      capacityMeshNodeId: "cn118",
      portPoints: [
        {
          x: -10.078125,
          y: 4.6875,
          z: 0,
          connectionName: "conn1",
        },
        {
          x: -9.84375,
          y: 3.75,
          z: 0,
          connectionName: "conn1",
        },
      ],
      center: {
        x: -9.84375,
        y: 4.21875,
      },
      width: 0.9375,
      height: 0.9375,
    },
  ],
  colorMap: {
    conn1: "hsl(0, 100%, 50%)",
  },
}

test("highdensityoverlap1", () => {
  const solver = new HighDensityRouteSolver(inputs)

  solver.solve()

  const solution1 = solver.routes[0]

  console.log(solution1)
  expect(solution1.route.length).toBe(2)
})
