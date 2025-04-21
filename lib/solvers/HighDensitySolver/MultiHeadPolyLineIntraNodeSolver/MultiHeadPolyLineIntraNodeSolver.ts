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
  bounds: { minX: number; maxX: number; minY: number; maxY: number }

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

    // Calculate bounds
    this.bounds = {
      minX:
        this.nodeWithPortPoints.center.x - this.nodeWithPortPoints.width / 2,
      maxX:
        this.nodeWithPortPoints.center.x + this.nodeWithPortPoints.width / 2,
      minY:
        this.nodeWithPortPoints.center.y - this.nodeWithPortPoints.height / 2,
      maxY:
        this.nodeWithPortPoints.center.y + this.nodeWithPortPoints.height / 2,
    }

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

  visualize(): GraphicsObject {
    const graphicsObject: Required<GraphicsObject> = {
      points: [],
      lines: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
      title: "MultiHeadPolyLineIntraNodeSolver Visualization",
    }

    // Draw node bounds
    graphicsObject.rects.push({
      center: this.nodeWithPortPoints.center,
      width: this.bounds.maxX - this.bounds.minX,
      height: this.nodeWithPortPoints.height,
      stroke: "gray",
      fill: "rgba(200, 200, 200, 0.1)",
      label: "Node Bounds",
    })

    // Draw input port points
    for (const pt of this.nodeWithPortPoints.portPoints) {
      graphicsObject.points.push({
        x: pt.x,
        y: pt.y,
        label: `${pt.connectionName} (z=${pt.z ?? 0})`,
        color: this.colorMap[pt.connectionName] ?? "blue",
      })
    }

    // Visualize the polylines from the first candidate (or current best)
    const candidateToVisualize = this.candidates[0] // Assuming the first is representative
    if (candidateToVisualize) {
      for (const polyLine of candidateToVisualize.polyLines) {
        const color = this.colorMap[polyLine.connectionName] ?? "purple"
        const pointsInPolyline = [
          polyLine.start,
          ...polyLine.mPoints,
          polyLine.end,
        ]

        // Draw segments of the polyline
        for (let i = 0; i < pointsInPolyline.length - 1; i++) {
          const p1 = pointsInPolyline[i]
          const p2 = pointsInPolyline[i + 1]
          graphicsObject.lines.push({
            points: [p1, p2],
            strokeColor: p1.z === 0 ? color : `rgba(128, 0, 128, 0.5)`, // Dimmer for layer 1
            strokeWidth: 0.1, // TODO: Use actual trace thickness?
            strokeDash: p1.z !== 0 ? "5,5" : undefined,
            label: `${polyLine.connectionName} segment (z=${p1.z})`,
          })
        }

        // Draw middle points (mPoints)
        for (const mPoint of polyLine.mPoints) {
          graphicsObject.circles.push({
            center: mPoint,
            radius: this.cellSize / 4, // Small circle for mPoints
            fill: mPoint.z === 0 ? color : `rgba(128, 0, 128, 0.5)`,
            label: `mPoint (z=${mPoint.z})`,
          })
        }

        // Draw vias if mPoints change layer (simple check)
        for (let i = 0; i < pointsInPolyline.length - 1; i++) {
          if (pointsInPolyline[i].z !== pointsInPolyline[i + 1].z) {
            // Assume via is at the point where the layer changes *from*
            graphicsObject.circles.push({
              center: pointsInPolyline[i],
              radius: 0.3, // TODO: Use actual via diameter
              fill: "rgba(0, 0, 255, 0.6)",
              label: `Via (z=${pointsInPolyline[i].z} -> z=${pointsInPolyline[i + 1].z})`,
            })
          }
        }
      }
    }

    return graphicsObject
  }
}
