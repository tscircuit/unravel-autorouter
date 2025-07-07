import cn2883 from "examples/assets/cn2883-nodeWithPortPoints.json"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"

export const hyperParameters = {
  SEGMENTS_PER_POLYLINE: 6,
}

export default () => {
  return (
    <HyperHighDensityDebugger nodeWithPortPoints={cn2883.nodeWithPortPoints} />
  )
}
