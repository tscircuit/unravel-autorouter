import { AutoroutingPipelineDebugger } from "lib/testing/AutoroutingPipelineDebugger"
import ledLetterS from "examples/assets/led-letter-s.json"
import type { SimpleRouteJson } from "lib/types"

export default () => {
  return (
    <AutoroutingPipelineDebugger
      srj={ledLetterS as unknown as SimpleRouteJson}
    />
  )
}
