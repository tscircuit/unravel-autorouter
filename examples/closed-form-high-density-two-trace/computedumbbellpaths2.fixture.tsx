import { DumbbellDebugger } from "lib/testing/DumbbellDebugger"

const ComputeDumbbellPathsFixture1 = () => {
  return (
    <DumbbellDebugger
      {...{
        A: {
          x: 0.44843477786630276,
          y: 9.775,
        },
        B: {
          x: 1.475,
          y: 10.850000000000001,
        },
        C: {
          x: 1.40625,
          y: 9.375,
          z: 0,
          connectionName: "source_trace_6",
        },
        D: {
          x: 0,
          y: 10.3125,
          z: 0,
          connectionName: "source_trace_6",
        },
        E: {
          x: 0.46875,
          y: 9.375,
          z: 0,
          connectionName: "source_net_0_mst1",
        },
        F: {
          x: 0.9375,
          y: 11.25,
          z: 0,
          connectionName: "source_net_0_mst1",
        },
        radius: 0.6,
        margin: 0.1,
        subdivisions: 1,
      }}
    />
  )
}

export default ComputeDumbbellPathsFixture1
