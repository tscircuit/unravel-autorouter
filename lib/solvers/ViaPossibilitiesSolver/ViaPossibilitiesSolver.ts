import { NodeWithPortPoints } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import {
  Face,
  getCentroidsFromInnerBoxIntersections,
} from "../HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getCentroidsFromInnerBoxIntersections"
import { getBoundsFromNodeWithPortPoints } from "lib/utils/getBoundsFromNodeWithPortPoints"
import { Bounds, Point, pointToSegmentDistance } from "@tscircuit/math-utils"
import { getPortPairMap, PortPairMap } from "lib/utils/getPortPairs"

export type ViaLocationHash = string
export type CandidateHash = string
export type ConnectionName = string
export type FaceId = string

export interface Candidate {
  viaLocationAssignments: Map<ViaLocationHash, ConnectionName>
}

export const hashCandidate = (candidate: Candidate): CandidateHash => {
  return Array.from(candidate.viaLocationAssignments.entries()).sort().join("|")
}
export const hashViaLocation = (p: Point) => {
  return `${p.x},${p.y}`
}

export interface FaceWithSegments extends Face {
  segments: Array<{ start: Point; end: Point }>
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
  faces: Map<FaceId, FaceWithSegments>
  bounds: Bounds
  portPairMap: PortPairMap
  connectionEndpointFaceMap: Map<
    ConnectionName,
    { startFaceId: FaceId; endFaceId: string }
  >
  exploredAssignments: Set<CandidateHash>

  constructor({
    nodeWithPortPoints,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
  }) {
    super()
    this.exploredAssignments = new Set()
    this.bounds = getBoundsFromNodeWithPortPoints(nodeWithPortPoints)
    this.portPairMap = getPortPairMap(nodeWithPortPoints)
    const segments: Segment[] = Array.from(this.portPairMap.values())

    const { faces } = getCentroidsFromInnerBoxIntersections(
      this.bounds,
      segments,
    )
    this.faces = new Map()
    for (let i = 0; i < faces.length; i++) {
      const { vertices } = faces[i]
      const segments: Array<{ start: Point; end: Point }> = []
      for (let u = 0; u < vertices.length; u++) {
        segments.push({
          start: vertices[u],
          end: vertices[(u + 1) % vertices.length],
        })
      }
      this.faces.set(`face${i.toString()}`, { ...faces[i], segments })
    }

    this.connectionEndpointFaceMap = new Map()
    for (const [connectionName, { start, end }] of this.portPairMap) {
      // Determine which face is the contains the start or end
      let startFaceId: string | null = null
      let endFaceId: string | null = null
      for (const [faceId, { segments }] of this.faces.entries()) {
        for (const seg of segments) {
          if (
            !startFaceId &&
            pointToSegmentDistance(start, seg.start, seg.end) < 0.001
          ) {
            startFaceId = faceId
            break
          }
          if (
            !endFaceId &&
            pointToSegmentDistance(end, seg.start, seg.end) < 0.001
          ) {
            endFaceId = faceId
            break
          }
        }
        if (startFaceId && endFaceId) break
      }

      if (!startFaceId || !endFaceId) {
        throw new Error(`Could not find face for connection ${connectionName}`)
      }

      this.connectionEndpointFaceMap.set(connectionName, {
        startFaceId,
        endFaceId,
      })
    }

    // TODO setup initial candidate
    this.candidates = [
      {
        viaLocationAssignments: new Map(),
      },
    ]
  }

  _step() {}

  getUnexploredNeighbors(candidate: Candidate): Candidate[] {}
}
