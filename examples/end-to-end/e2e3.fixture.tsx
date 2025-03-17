import { AutoroutingPipelineDebugger } from "lib/testing/AutoroutingPipelineDebugger"
import { SimpleRouteJson } from "lib/types"
import simpleRouteJson from "examples/assets/e2e3.json"

export default () => (
  <AutoroutingPipelineDebugger srj={simpleRouteJson as SimpleRouteJson} />
)
