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
          center: { x: 5, y: 5 },
          width: 2,
          height: 2,
          connectedTo: [],
        },
        // Small obstacles at each connection point
        {
          type: "rect",
          layers: ["top"],
          center: { x: 1, y: 1 },
          width: 0.5,
          height: 0.5,
          connectedTo: ["connection1"],
        },
        {
          type: "rect",
          layers: ["top"],
          center: { x: 9, y: 9 },
          width: 0.5,
          height: 0.5,
          connectedTo: ["connection1"],
        },
        {
          type: "rect",
          layers: ["top"],
          center: { x: 1, y: 9 },
          width: 0.5,
          height: 0.5,
          connectedTo: ["connection2"],
        },
        {
          type: "rect",
          layers: ["top"],
          center: { x: 9, y: 1 },
          width: 0.5,
          height: 0.5,
          connectedTo: ["connection2"],
        },
        {
          type: "rect",
          layers: ["top"],
          center: { x: 4, y: 1 },
          width: 0.5,
          height: 0.5,
          connectedTo: ["connection2"],
        },
      ],
      connections: [
        {
          name: "connection1",
          pointsToConnect: [
            { x: 1, y: 1, layer: "top", pcb_port_id: "port1" },
            { x: 9, y: 9, layer: "top", pcb_port_id: "port2" },
          ],
        },
        {
          name: "connection2",
          pointsToConnect: [
            { x: 1, y: 9, layer: "top", pcb_port_id: "port3" },
            { x: 9, y: 1, layer: "top", pcb_port_id: "port4" },
            { x: 4, y: 1, layer: "top", pcb_port_id: "port4" },
          ],
        },
      ],
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    }

    const solver = new CapacityMeshSolver(simpleSrj)
    await solver.solve()

    const result = solver.getOutputSimpleRouteJson()
    console.log(result.traces!.length)
    expect(convertSrjToGraphicsObject(result)).toMatchGraphicsSvg(
      import.meta.path,
    )
  })
})
