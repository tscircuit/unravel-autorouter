import { NodeWithPortPoints } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import {
  Face,
  getCentroidsFromInnerBoxIntersections,
} from "../HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getCentroidsFromInnerBoxIntersections"
import { getBoundsFromNodeWithPortPoints } from "lib/utils/getBoundsFromNodeWithPortPoints"
import { Bounds } from "@tscircuit/math-utils"
import { getPortPairMap, PortPairMap } from "lib/utils/getPortPairs"

export type ViaLocationHash = string
export type ConnectionName = string

export interface Candidate {
  viaLocationAssignments: Map<ViaLocationHash, ConnectionName>
}

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface Segment {
  start: Point3
  end: Point3
  connectionName: string
}

export class ViaPossibilitiesSolver extends BaseSolver {
  candidates: Candidate[]
  faces: Array<Face>
  bounds: Bounds
  portPairMap: PortPairMap

  constructor({
    nodeWithPortPoints,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
  }) {
    super()
    this.candidates = []
    this.bounds = getBoundsFromNodeWithPortPoints(nodeWithPortPoints)
    this.portPairMap = getPortPairMap(nodeWithPortPoints)
    const segments: Segment[] = Array.from(this.portPairMap.values())

    const { faces } = getCentroidsFromInnerBoxIntersections(
      this.bounds,
      segments,
    )
    this.faces = faces
  }

  _step() {}
}
