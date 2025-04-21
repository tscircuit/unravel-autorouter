import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { BaseSolver } from "lib/solvers/BaseSolver"
import { HighDensityHyperParameters } from "../HighDensityHyperParameters"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import { GraphicsObject } from "graphics-debug"

interface Point {
  x: number
  y: number
  z: number
}

export interface PolyLine {
  connectionName: string
  start: Point
  end: Point
  mPoints: Point[]
  hash: string
}

export interface Candidate {
  polyLines: PolyLine[]
  g: number
  h: number
  f: number
  hash: string
}

export const computePolyLineHash = (polyLine: Omit<PolyLine, "hash">) => {
  return polyLine.mPoints.map((p) => `${p.x},${p.y},${p.z}`).join("_")
}

export const computeCandidateHash = (candidate: Omit<Candidate, "hash">) => {
  return candidate.polyLines.map((p) => computePolyLineHash(p)).join("|")
}

export const createPolyLine = (polyLinePartial: Omit<PolyLine, "hash">) => {
  ;(polyLinePartial as any).hash = computePolyLineHash(polyLinePartial)
  return polyLinePartial as PolyLine
}

export const createCandidate = (candidatePartial: Omit<Candidate, "hash">) => {
  ;(candidatePartial as any).hash = computeCandidateHash(candidatePartial)
  return candidatePartial as Candidate
}

export const constructMiddlePoints = (params: {
  start: Point
  end: Point
  segmentsPerPolyline: number
}) => {
  const { start, end, segmentsPerPolyline } = params

  const dx = end.x - start.x
  const dy = end.y - start.y

  const middlePoints: Point[] = []

  for (let i = 0; i < segmentsPerPolyline; i++) {
    const t = (i + 1) / (segmentsPerPolyline + 1)
    const point = {
      x: start.x + t * dx,
      y: start.y + t * dy,
      z: start.z,
    }
    middlePoints.push(point)
  }

  return middlePoints
}

export class MultiHeadPolyLineIntraNodeSolver extends BaseSolver {
  nodeWithPortPoints: NodeWithPortPoints
  colorMap: Record<string, string>
  hyperParameters: Partial<HighDensityHyperParameters>
  connMap?: ConnectivityMap
  candidates: Candidate[]

  SEGMENTS_PER_POLYLINE = 3

  cellSize: number

  constructor(params: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
    hyperParameters?: Partial<HighDensityHyperParameters>
    connMap?: ConnectivityMap
  }) {
    super()
    this.nodeWithPortPoints = params.nodeWithPortPoints
    this.colorMap = params.colorMap ?? {}
    this.hyperParameters = params.hyperParameters ?? {}
    this.connMap = params.connMap

    // TODO swap with more sophisticated grid in SingleHighDensityRouteSolver
    this.cellSize = this.nodeWithPortPoints.width / 10

    this.candidates = []

    this.setupInitialPolyLines()
  }

  setupInitialPolyLines() {
    const portPairs: Map<string, { start: Point; end: Point }> = new Map()
    this.nodeWithPortPoints.portPoints.forEach((portPoint) => {
      if (!portPairs.has(portPoint.connectionName)) {
        portPairs.set(portPoint.connectionName, {
          start: portPoint,
          end: null as any,
        })
      } else {
        portPairs.get(portPoint.connectionName)!.end = portPoint
      }
    })

    // Conver the portPairs into PolyLines
    const polyLines: PolyLine[] = []
    for (const [connectionName, portPair] of portPairs.entries()) {
      const middlePoints = constructMiddlePoints({
        start: portPair.start,
        end: portPair.end,
        segmentsPerPolyline: this.SEGMENTS_PER_POLYLINE,
      })

      polyLines.push(
        createPolyLine({
          connectionName,
          start: portPair.start,
          end: portPair.end,
          mPoints: middlePoints,
        }),
      )
    }

    this.candidates.push(createCandidate({ polyLines, g: 0, h: 0, f: 0 }))
  }

  getNeighbors(candidate: Candidate) {
    const neighbors: Candidate[] = []

    // TODO each polyline can move it's mPoints in any direction or down as
    // a via, in this function we check if it's valid to make the movement
    // and if so, return it as a neighbor

    return neighbors
  }

  _step() {}

  visualize() {
    const graphicsObject: Required<GraphicsObject> = {
      points: [],
      lines: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "MultiHeadPolyLineIntraNodeSolver",
    }

    const currentCandidates = this.candidates[0]

    return graphicsObject
  }
}
