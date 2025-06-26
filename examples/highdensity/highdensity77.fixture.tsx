import cn1472 from "examples/assets/cn1472-nodeWithPortPoints.json"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"

export const hyperParameters = {
  SEGMENTS_PER_POLYLINE: 6,
}

export default () => {
  return (
    <HyperHighDensityDebugger nodeWithPortPoints={cn1472.nodeWithPortPoints} />
  )
}
