import { CapacityMeshPipelineDebugger } from "lib/testing/CapacityMeshPipelineDebugger"
import { SimpleRouteJson } from "lib/types"
import simpleRouteJson from "./assets/e2e3.json"

export default () => (
  <CapacityMeshPipelineDebugger srj={simpleRouteJson as SimpleRouteJson} />
)
