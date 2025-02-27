import { expect, test, describe } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import { SimpleRouteJson } from "lib/types"
import { convertSrjToGraphicsObject } from "./fixtures/convertSrjToGraphicsObject"

describe("CapacityMeshSolver", () => {
  test("getOutputSimpleRouteJson throws when solver is not complete", () => {
    const simpleSrj = {
      layerCount: 2,
      minTraceWidth: 0.15,
      obstacles: [],
      connections: [],
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    }

    const solver = new CapacityMeshSolver(simpleSrj)

    expect(() => solver.getOutputSimpleRouteJson()).toThrow(
      "Cannot get output before solving is complete",
    )
  })

  test("should solve with obstacles and connections", async () => {
    const simpleSrj: SimpleRouteJson = {
      layerCount: 2,
      minTraceWidth: 0.15,
      obstacles: [
        {
          type: "rect",
          layers: ["top", "bottom"],
          center: { x: 50, y: 50 },
          width: 20,
          height: 20,
          connectedTo: [],
        },
      ],
      connections: [
        {
          name: "connection1",
          pointsToConnect: [
            { x: 10, y: 10, layer: "top", pcb_port_id: "port1" },
            { x: 90, y: 90, layer: "top", pcb_port_id: "port2" },
          ],
        },
        {
          name: "connection2",
          pointsToConnect: [
            { x: 10, y: 90, layer: "top", pcb_port_id: "port3" },
            { x: 90, y: 10, layer: "top", pcb_port_id: "port4" },
            { x: 40, y: 10, layer: "top", pcb_port_id: "port4" },
          ],
        },
      ],
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    }

    const solver = new CapacityMeshSolver(simpleSrj)
    await solver.solve()

    const result = solver.getOutputSimpleRouteJson()
    expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
      import.meta.path,
    )
  })
})
