import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { BaseSolver } from "lib/solvers/BaseSolver"
import { HighDensityHyperParameters } from "../HighDensityHyperParameters"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import { GraphicsObject } from "graphics-debug"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { safeTransparentize } from "lib/solvers/colors"

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
}) => {
  const { start, end, segmentsPerPolyline } = params

  const dx = end.x - start.x
  const dy = end.y - start.y

  const middlePoints: Point[] = []

  let lastZ = start.z1
  for (let i = 0; i < segmentsPerPolyline; i++) {
    const t = (i + 1) / (segmentsPerPolyline + 1)
    const point = {
      x: start.x + t * dx,
      y: start.y + t * dy,
      z1: lastZ,
      z2: t > 0.5 ? end.z1 : lastZ,
    }
    if (t > 0.5) {
      lastZ = end.z1
    }
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

const constructPolyLineWithSymmetricVias = (params: {
  start: Point
  end: Point
  viaIndex: number
}) => {}

/**
 * Computes all valid combinations of via counts for a set of polylines.
 *
 * @param portPairs - A map where keys are connection names and values are objects
 *                    containing the start and end points (with z1/z2 layers) for each connection.
 * @param segmentsPerPolyline - The number of intermediate segments (mPoints) in each polyline.
 *                              This determines the maximum possible number of vias.
 * @returns An array of arrays, where each inner array represents a valid combination
 *          of via counts for all polylines, ordered according to the input portPairs.
 */
export const computeViaCountVariants = (
  portPairs: Map<string, { start: Point; end: Point }>,
  segmentsPerPolyline: number,
  maxViaCount: number,
): Array<number[]> => {
  const possibleViaCountsPerPolyline: number[][] = []

  for (const [_connectionName, portPair] of portPairs.entries()) {
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

  let variants: number[][] = [[]]
  for (const possibleCounts of possibleViaCountsPerPolyline) {
    const nextVariants: number[][] = []
    for (const variant of variants) {
      for (const count of possibleCounts) {
        if (variant.reduce((acc, curr) => acc + curr, 0) > maxViaCount) {
          continue
        }
        nextVariants.push([...variant, count])
      }
    }
    variants = nextVariants
  }

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
    this.availableZ = Array.from(
      new Set(this.nodeWithPortPoints.portPoints.map((pt) => pt.z)),
    )

    const areaInsideNode =
      this.nodeWithPortPoints.width * this.nodeWithPortPoints.height
    const areaPerVia = this.viaDiameter * this.viaDiameter

    this.maxViaCount = Math.floor(areaInsideNode / areaPerVia)

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

    // Create all the possible variations of the via counts for each port pair
    type PossibleViaCountVariantions = Array<number>

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
     *
     * We would have these possible variants:
     * [
     *  [0, 1, 0],
     *  [0, 1, 2],
     *  [0, 1, 4],
     *  [0, 3, 0],
     *  [0, 3, 2],
     *  [0, 3, 4],
     *  [2, 1, 0],
     *  [2, 1, 2],
     *  [2, 1, 4],
     *  [2, 3, 0],
     *  [2, 3, 2],
     *  [2, 3, 4],
     *  [4, 1, 0],
     *  [4, 1, 2],
     *  [4, 1, 4],
     *  [4, 3, 0],
     *  [4, 3, 2],
     *  [4, 3, 4],
     * ]
     */
    const viaCountVariants = computeViaCountVariants(
      portPairs,
      this.SEGMENTS_PER_POLYLINE,
      this.maxViaCount,
    )

    // Convert the portPairs into PolyLines for the initial candidate
    const initialPolyLines: PolyLine[] = []
    for (const [connectionName, portPair] of portPairs.entries()) {
      const middlePoints = constructMiddlePoints({
        start: portPair.start,
        end: portPair.end,
        segmentsPerPolyline: this.SEGMENTS_PER_POLYLINE,
      })

      initialPolyLines.push(
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
      polyLines: initialPolyLines,
      hash: computeCandidateHash(initialPolyLines),
      g: 0,
      h: 0, // TODO: Compute initial H
      f: 0,
    })
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

    this.candidates.push(...this.getNeighbors(currentCandidate))
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
