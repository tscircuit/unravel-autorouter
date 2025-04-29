import cn9630 from "examples/assets/cn9630-nodeWithPortPoints.json"
import React from "react"
import { ViaPossibilitiesDebugger } from "./ViaPossibilitiesDebugger"
import { NodeWithPortPoints } from "lib/types/high-density-types"

export default () => {
  // Cast is needed because the imported JSON doesn't perfectly match the type
  const nodeWithPortPoints = cn9630.nodeWithPortPoints as NodeWithPortPoints

  return <ViaPossibilitiesDebugger nodeWithPortPoints={nodeWithPortPoints} />
}
