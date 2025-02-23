import { HighDensityDebugger } from "lib/testing/HighDensityDebugger"

export default () => (
  <HighDensityDebugger
    hyperParameters={{
      CELL_SIZE_FACTOR: 1,
      FLIP_TRACE_ALIGNMENT_DIRECTION: true,
      VIA_PENALTY_FACTOR_2: 0.1,
    }}
    {...{
      nodeWithPortPoints: {
        capacityMeshNodeId: "cn11470",
        portPoints: [
          { x: 105.5, y: -25, connectionName: "connectivity_net3412" },
          { x: 106, y: -25, connectionName: "connectivity_net3434" },
          { x: 106.5, y: -25, connectionName: "connectivity_net3995" },
          { x: 107, y: -25, connectionName: "connectivity_net4017" },
          {
            x: 110,
            y: -29.285714285714285,
            connectionName: "connectivity_net2125",
          },
          {
            x: 110,
            y: -28.571428571428573,
            connectionName: "connectivity_net2169",
          },
          {
            x: 110,
            y: -27.857142857142858,
            connectionName: "connectivity_net2213",
          },
          {
            x: 110,
            y: -27.142857142857142,
            connectionName: "connectivity_net3434",
          },
          {
            x: 110,
            y: -26.428571428571427,
            connectionName: "connectivity_net4006",
          },
          {
            x: 110,
            y: -25.714285714285715,
            connectionName: "connectivity_net4017",
          },
          {
            x: 105,
            y: -29.285714285714285,
            connectionName: "connectivity_net2125",
          },
          {
            x: 105,
            y: -28.571428571428573,
            connectionName: "connectivity_net2169",
          },
          {
            x: 105,
            y: -27.857142857142858,
            connectionName: "connectivity_net2213",
          },
          {
            x: 105,
            y: -27.142857142857142,
            connectionName: "connectivity_net3412",
          },
          {
            x: 105,
            y: -26.428571428571427,
            connectionName: "connectivity_net3995",
          },
          {
            x: 105,
            y: -25.714285714285715,
            connectionName: "connectivity_net4006",
          },
        ],
        center: { x: 107.5, y: -27.5 },
        width: 5,
        height: 5,
      },
    }}
  />
)
