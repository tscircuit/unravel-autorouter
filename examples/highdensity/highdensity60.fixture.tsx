import cn1554 from "examples/assets/cn1554-nodeWithPortPoints.json"
import { HyperHighDensityDebugger } from "lib/testing/HyperHighDensityDebugger"

export const hyperParameters = {
  SEGMENTS_PER_POLYLINE: 6,
}

export default () => {
  return (
    <HyperHighDensityDebugger nodeWithPortPoints={cn1554.nodeWithPortPoints} />
  )
}
