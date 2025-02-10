import { InteractiveGraphics } from "graphics-debug/react"
import { CapacityMeshNodeSolver } from "../lib/solvers/CapacityMeshSolver/CapacityMeshNodeSolver"

export default () => {
  const meshSolver = new CapacityMeshNodeSolver({
    bounds: {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
    },
    layerCount: 1,
    minTraceWidth: 1,
    obstacles: [
      {
        center: {
          x: 50,
          y: 50,
        },
        width: 20,
        height: 10,
        type: "rect",
        layers: ["top", "bottom"],
        connectedTo: [],
      },
      {
        center: {
          x: 55,
          y: 90,
        },
        width: 20,
        height: 10,
        type: "rect",
        layers: ["top", "bottom"],
        connectedTo: [],
      },
    ],
    connections: [
      {
        name: "trace1",
        pointsToConnect: [
          {
            x: 15,
            y: 10,
            layer: "top",
          },
          {
            x: 55,
            y: 90,
            layer: "top",
          },
        ],
      },
    ],
  })
  meshSolver.solve()
  return <InteractiveGraphics graphics={meshSolver.visualize()} />
}
