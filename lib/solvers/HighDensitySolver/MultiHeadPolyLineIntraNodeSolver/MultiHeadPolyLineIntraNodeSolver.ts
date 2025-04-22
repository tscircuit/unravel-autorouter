import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { BaseSolver } from "lib/solvers/BaseSolver"
import { HighDensityHyperParameters } from "../HighDensityHyperParameters"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import { GraphicsObject } from "graphics-debug"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { safeTransparentize } from "lib/solvers/colors"
import { getIntraNodeCrossings } from "lib/utils/getIntraNodeCrossings"
import { createSymmetricArray } from "./createSymmetricArray"

interface Point {
  x: number
  y: number

  // If a via, z1 is the layer of the start point, z2 is the layer of the end
  // point
  // If not a via, z1 and z2 are the same
  z1: number
  z2: number
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
  return polyLine.mPoints.map((p) => `${p.x},${p.y},${p.z1},${p.z2}`).join("_")
}

export const computeCandidateHash = (polyLines: PolyLine[]) => {
  return polyLines.map((p) => computePolyLineHash(p)).join("|")
}

export const createPolyLine = (polyLinePartial: Omit<PolyLine, "hash">) => {
  ;(polyLinePartial as any).hash = computePolyLineHash(polyLinePartial)
  return polyLinePartial as PolyLine
}

export const constructMiddlePoints = (params: {
  start: Point
  end: Point
  segmentsPerPolyline: number
  viaCount: number
  availableZ: number[]
}) => {
  const { start, end, segmentsPerPolyline, viaCount, availableZ } = params

  const dx = end.x - start.x
  const dy = end.y - start.y

  const middlePoints: Point[] = []

  const indicesToFlip = createSymmetricArray(segmentsPerPolyline, viaCount)
  console.log({ viaCount, indicesToFlip })

  let lastZ = start.z1
  const availableZOffset = availableZ.indexOf(start.z1)
  let zFlips = 0
  for (let i = 0; i < segmentsPerPolyline; i++) {
    const isFlipped = indicesToFlip[i] === 1
    const nextZ = isFlipped
      ? availableZ[(availableZOffset + zFlips + 1) % availableZ.length]
      : lastZ
    const t = (i + 1) / (segmentsPerPolyline + 1)
    const point = {
      x: start.x + t * dx,
      y: start.y + t * dy,
      z1: lastZ,
      z2: nextZ,
    }
    lastZ = nextZ
    if (isFlipped) zFlips++
    middlePoints.push(point)
  }

  return middlePoints
}

export const withinBounds = (
  point: Point,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

export const clonePolyLinesWithMutablePoint = (
  polyLines: PolyLine[],
  lineIndex: number,
  mPointIndex: number,
): [PolyLine[], Point] => {
  const mutablePoint = {
    x: polyLines[lineIndex].mPoints[mPointIndex].x,
    y: polyLines[lineIndex].mPoints[mPointIndex].y,
    z1: polyLines[lineIndex].mPoints[mPointIndex].z1,
    z2: polyLines[lineIndex].mPoints[mPointIndex].z2,
  }
  return [
    [
      ...polyLines.slice(0, lineIndex),
      {
        ...polyLines[lineIndex],
        mPoints: [
          ...polyLines[lineIndex].mPoints.slice(0, mPointIndex),
          mutablePoint,
          ...polyLines[lineIndex].mPoints.slice(mPointIndex + 1),
        ],
      },
      ...polyLines.slice(lineIndex + 1),
    ],
    mutablePoint,
  ]
}

function getCombinations<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return []
  if (arrays.length === 1) return arrays[0].map((item) => [item])

  const [first, ...rest] = arrays
  const restCombinations = getCombinations(rest)

  const combinations: T[][] = []

  for (const item of first) {
    for (const combo of restCombinations) {
      combinations.push([item, ...combo])
    }
  }

  return combinations
}

/**
 * Each item in viaCountVariants is an array specifying the number of vias
 * for each polyline. If a polyline has a layer change, it will always have
 * an odd number of vias, if it doesn't have a layer change, it will always
 * have an even number of vias or 0
 *
 * e.g. if we have...
 * SEGMENTS_PER_POLYLINE = 3
 * polyLine0 = no layer change
 * polyLine1 = layer change
 *
 * We would have these possible variants:
 * [
 *  [0, 1],
 *  [0, 3],
 *  [2, 1],
 *  [2, 3]
 * ]
 *
 * Likewise, if we have...
 * SEGMENTS_PER_POLYLINE = 4
 * polyLine0 = no layer change
 * polyLine1 = layer change
 * polyLine2 = no layer change
 * maxViaCount = 4
 * minViaCount = 2 (sometimes we know, because of same-layer intersections,
 *                  there must be at least N vias)
 *
 * We would have these possible variants:
 * [
 *  [0, 1, 0],
 *  [0, 1, 2],
 *  [0, 3, 0],
 *  [2, 1, 0],
 * ]
 */
export const computeViaCountVariants = (
  portPairsEntries: Array<
    [connectionName: string, { start: Point; end: Point }]
  >,
  segmentsPerPolyline: number,
  maxViaCount: number,
  minViaCount: number = 0,
): Array<number[]> => {
  const possibleViaCountsPerPolyline: number[][] = []

  for (const [, portPair] of portPairsEntries) {
    const needsLayerChange = portPair.start.z1 !== portPair.end.z1
    const possibleCounts: number[] = []

    for (let i = 0; i <= segmentsPerPolyline; i++) {
      const isOdd = i % 2 !== 0
      if (needsLayerChange && isOdd) {
        possibleCounts.push(i)
      } else if (!needsLayerChange && !isOdd) {
        possibleCounts.push(i)
      }
    }
    possibleViaCountsPerPolyline.push(possibleCounts)
  }

  // Generate Cartesian product of possible counts
  if (possibleViaCountsPerPolyline.length === 0) {
    return [[]] // No polylines, return one variant with empty counts
  }

  const variants: number[][] = getCombinations(
    possibleViaCountsPerPolyline,
  ).filter((variant) => {
    let sum = 0
    for (const count of variant) sum += count
    return sum >= minViaCount && sum <= maxViaCount
  })

  return variants
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

  viaDiameter: number = 0.6
  obstacleMargin: number = 0.1
  traceWidth: number = 0.15
  availableZ: number[] = []

  queuedCandidateHashes: Set<string> = new Set()

  maxViaCount: number

  constructor(params: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
    hyperParameters?: Partial<HighDensityHyperParameters>
    connMap?: ConnectivityMap
  }) {
    super()
    this.MAX_ITERATIONS = 100e3
    this.nodeWithPortPoints = params.nodeWithPortPoints
    this.colorMap =
      params.colorMap ??
      generateColorMapFromNodeWithPortPoints(params.nodeWithPortPoints)
    this.hyperParameters = params.hyperParameters ?? {}
    this.connMap = params.connMap

    // TODO swap with more sophisticated grid in SingleHighDensityRouteSolver
    this.cellSize = this.nodeWithPortPoints.width / 5

    this.candidates = []
    this.availableZ = this.nodeWithPortPoints.availableZ ?? [0, 1]

    const areaInsideNode =
      this.nodeWithPortPoints.width * this.nodeWithPortPoints.height
    const areaPerVia =
      (this.viaDiameter + this.obstacleMargin * 2 + this.traceWidth / 2) ** 2

    this.maxViaCount = Math.floor(areaInsideNode / areaPerVia)
    console.log({ maxViaCount: this.maxViaCount })

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

  /**
   * Unlike most A* solvers with one initial candidate, we create a candidate
   * for each configuration of vias we want to test, this way when computing
   * neighbors we never consider changing layers
   */
  setupInitialPolyLines() {
    const portPairs: Map<string, { start: Point; end: Point }> = new Map()
    this.nodeWithPortPoints.portPoints.forEach((portPoint) => {
      if (!portPairs.has(portPoint.connectionName)) {
        portPairs.set(portPoint.connectionName, {
          start: { ...portPoint, z1: portPoint.z ?? 0, z2: portPoint.z ?? 0 },
          end: null as any,
        })
      } else {
        portPairs.get(portPoint.connectionName)!.end = {
          ...portPoint,
          z1: portPoint.z ?? 0,
          z2: portPoint.z ?? 0,
        }
      }
    })

    const { numSameLayerCrossings, numTransitions } = getIntraNodeCrossings(
      this.nodeWithPortPoints,
    )

    const portPairsEntries = Array.from(portPairs.entries())
    const viaCountVariants = computeViaCountVariants(
      portPairsEntries,
      this.SEGMENTS_PER_POLYLINE,
      this.maxViaCount,
      numSameLayerCrossings * 2 + numTransitions,
    )

    // Convert the portPairs into PolyLines for the initial candidate
    for (const viaCountVariant of viaCountVariants) {
      const polyLines: PolyLine[] = []
      for (let i = 0; i < portPairsEntries.length; i++) {
        const [connectionName, portPair] = portPairsEntries[i]
        const viaCount = viaCountVariant[i]
        const middlePoints = constructMiddlePoints({
          start: portPair.start,
          end: portPair.end,
          segmentsPerPolyline: this.SEGMENTS_PER_POLYLINE,
          viaCount,
          availableZ: this.availableZ,
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

      // TODO: Create multiple initial candidates based on viaCountVariants
      // For now, just push the one candidate
      this.candidates.push({
        polyLines: polyLines,
        hash: computeCandidateHash(polyLines),
        g: 0,
        h: 0, // TODO: Compute initial H
        f: 0,
      })
    }
  }

  /**
   * g is the cost of each candidate, we consider complexity (deviation from
   * the straight line path for # of operations). This means g increases by
   * 1 from the parent for each operation
   */
  computeG(polyLines: PolyLine[], candidate: Candidate) {
    return candidate.g + 1
  }

  /**
   * h is the heuristic cost of each candidate. We consider the number of
   * intersections of the polyline
   */
  computeH(polyLines: PolyLine[]) {
    return 0
  }

  /**
   * Mutate the mutablePoint and return true if the operation is valid
   */
  NEIGHBOR_OPERATIONS = [
    (mutablePoint: Point) => {
      mutablePoint.x += this.cellSize
    },
    (mutablePoint: Point) => {
      mutablePoint.x -= this.cellSize
    },
    (mutablePoint: Point) => {
      mutablePoint.y += this.cellSize
    },
    (mutablePoint: Point) => {
      mutablePoint.y -= this.cellSize
    },
  ]

  getNeighbors(candidate: Candidate) {
    const neighbors: Candidate[] = []

    // TODO each polyline can move it's mPoints in any direction or down as
    // a via, in this function we check if it's valid to make the movement
    // and if so, return it as a neighbor
    for (let i = 0; i < candidate.polyLines.length; i++) {
      for (let j = 0; j < this.SEGMENTS_PER_POLYLINE; j++) {
        const previousMutablePoint = candidate.polyLines[i].mPoints[j]
        const isVia = previousMutablePoint.z1 !== previousMutablePoint.z2

        // HACK: We're not moving vias, as soon as a point becomes a via we
        // consider that a leaf node for that point.
        if (isVia) continue

        for (const opFn of this.NEIGHBOR_OPERATIONS) {
          const [newPolyLines, mutablePoint] = clonePolyLinesWithMutablePoint(
            candidate.polyLines,
            i,
            j,
          )
          opFn(mutablePoint)

          if (!withinBounds(mutablePoint, this.bounds)) continue
          const neighborHash = computeCandidateHash(newPolyLines)
          if (this.queuedCandidateHashes.has(neighborHash)) continue

          const g = this.computeG(newPolyLines, candidate)
          const h = this.computeH(newPolyLines)
          const newNeighbor: Candidate = {
            polyLines: newPolyLines,
            g,
            h,
            f: g + h,
            hash: neighborHash,
          }
          this.queuedCandidateHashes.add(neighborHash)

          neighbors.push(newNeighbor)
        }
      }
    }

    return neighbors
  }

  _step() {
    this.candidates.sort((a, b) => a.f - b.f)
    const currentCandidate = this.candidates.shift()!
    if (!currentCandidate) {
      this.failed = true
      return
    }

    // this.candidates.push(...this.getNeighbors(currentCandidate))
  }

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
    graphicsObject.lines.push({
      points: [
        { x: this.bounds.minX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.minY },
      ],
      strokeColor: "gray",
    })

    // Draw input port points
    for (const pt of this.nodeWithPortPoints.portPoints) {
      graphicsObject.points.push({
        x: pt.x,
        y: pt.y,
        // Assuming port points represent a single layer entry/exit, use z or default to 0
        label: `${pt.connectionName} (Port z=${pt.z ?? 0})`,
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
          const p1 = pointsInPolyline[i] // Point where segment starts (or via ends)
          const p2 = pointsInPolyline[i + 1] // Point where segment ends (or via starts)

          // A segment exists between p1 and p2 on layer p1.z2 (layer after p1's potential via)
          // which should be the same as p2.z1 (layer before p2's potential via)
          // If p1.z2 !== p2.z1, something is wrong in the data structure.
          const segmentLayer = p1.z2
          const isLayer0 = segmentLayer === 0
          const segmentColor = isLayer0 ? color : safeTransparentize(color, 0.5)

          graphicsObject.lines.push({
            points: [p1, p2],
            strokeColor: segmentColor,
            strokeWidth: 0.1, // TODO: Use actual trace thickness from HighDensityRoute?
            strokeDash: !isLayer0 ? "5,5" : undefined, // Dashed for layers > 0
            label: `${polyLine.connectionName} segment (z=${segmentLayer})`,
          })
        }

        // Draw points (start, mPoints, end) and Vias
        for (const point of pointsInPolyline) {
          const isVia = point.z1 !== point.z2
          const pointLayer = point.z1 // Layer before potential via

          if (isVia) {
            // Draw Via
            graphicsObject.circles.push({
              center: point,
              radius: this.viaDiameter / 2,
              fill: color, // Distinct Via color
              label: `Via (${polyLine.connectionName} z=${point.z1} -> z=${point.z2})`,
            })
          } else {
            // Draw regular point (only draw mPoints for clarity, start/end are ports)
            if (polyLine.mPoints.includes(point)) {
              const isLayer0 = pointLayer === 0
              const pointColor = isLayer0
                ? color
                : safeTransparentize(color, 0.5)
              graphicsObject.circles.push({
                center: point,
                radius: this.cellSize / 5, // Small circle for mPoints
                fill: pointColor,
                label: `mPoint (${polyLine.connectionName} z=${pointLayer})`,
              })
            }
          }
        }
      }
    }

    return graphicsObject
  }
}
