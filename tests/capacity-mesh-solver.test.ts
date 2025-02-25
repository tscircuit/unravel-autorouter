import { expect, test, describe } from "bun:test"
import { CapacityMeshSolver } from "../lib"

describe("CapacityMeshSolver", () => {
  test("getOutputSimpleRouteJson throws when solver is not complete", () => {
    const simpleSrj = {
      layerCount: 2,
      minTraceWidth: 0.15,
      obstacles: [],
      connections: [],
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 }
    }
    
    const solver = new CapacityMeshSolver(simpleSrj)
    
    expect(() => solver.getOutputSimpleRouteJson()).toThrow("Cannot get output before solving is complete")
  })
})