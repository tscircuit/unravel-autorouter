import { CapacityMeshPipelineDebugger } from "lib/testing/CapacityMeshPipelineDebugger"
import boardWithTopAndBottom from "examples/assets/boardwithtopandbottom.json"

export default () => {
  return <CapacityMeshPipelineDebugger srj={boardWithTopAndBottom as any} />
}
