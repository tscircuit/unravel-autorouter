import SegmentOptimizerDebugger from "lib/testing/SegmentOptimizerDebugger"
import inputs from "./assets/segmenttopoint4.json"

export default function SegmentToPoint4Fixture() {
  return <SegmentOptimizerDebugger 
    segments={inputs.segments} 
    colorMap={inputs.colorMap} 
    nodes={inputs.nodes} 
  />
}
