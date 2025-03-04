import { CapacityMeshPipelineDebugger } from "lib/testing/CapacityMeshPipelineDebugger"
import { SimpleRouteJson } from "lib/types"
import simpleRouteJson from "examples/assets/e2e2.json"

export default () => (
  <CapacityMeshPipelineDebugger srj={simpleRouteJson as SimpleRouteJson} />
)
