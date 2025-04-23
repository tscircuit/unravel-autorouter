import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { BaseSolver } from "lib/solvers/BaseSolver"
import { HighDensityHyperParameters } from "../HighDensityHyperParameters"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import { GraphicsObject } from "graphics-debug"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { safeTransparentize } from "lib/solvers/colors"
import { getIntraNodeCrossings } from "lib/utils/getIntraNodeCrossings"
import { createSymmetricArray } from "./createSymmetricArray"
import {
  distance,
  doSegmentsIntersect,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import { getPossibleInitialViaPositions } from "./getPossibleInitialViaPositions"
import { getEveryPossibleOrdering } from "./getEveryPossibleOrdering"
import { getEveryCombinationFromChoiceArray } from "./getEveryCombinationFromChoiceArray"

export interface MHPoint {
  x: number
  y: number
  xMoves: number
  yMoves: number

  // If a via, z1 is the layer of the start point, z2 is the layer of the end
  // point
  // If not a via, z1 and z2 are the same
  z1: number
  z2: number
}

export interface PolyLine {
  connectionName: string
  start: MHPoint
  end: MHPoint
  mPoints: MHPoint[]
  hash: string
}

export interface Candidate {
  polyLines: PolyLine[]
  g: number
  h: number
  f: number
  hash: string
  minGaps: number[]
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

export const constructMiddlePointsWithViaPositions = (params: {
  start: MHPoint
  end: MHPoint
  segmentsPerPolyline: number
  viaCount: number
  availableZ: number[]
  viaPositions: Array<{ x: number; y: number }>
}) => {
  const {
    start,
    end,
    segmentsPerPolyline,
    viaPositions,
    viaCount,
    availableZ,
  } = params

  const viaIndices = createSymmetricArray(segmentsPerPolyline, viaCount)
  const middlePoints: (MHPoint | null)[] = viaIndices.map(() => null)

  let viasAdded = 0
  let lastZ = start.z1
  const availableZOffset = availableZ.indexOf(start.z1)
  for (let i = 0; i < viaIndices.length; i++) {
    if (viaIndices[i] === 1) {
      const nextZ =
        availableZ[(availableZOffset + viasAdded + 1) % availableZ.length]
      middlePoints[i] = {
        ...viaPositions[viasAdded],
        xMoves: 0,
        yMoves: 0,
        z1: lastZ,
        z2: nextZ,
      }
      lastZ = nextZ
      viasAdded++
    }
  }

  let left: MHPoint = start
  for (let i = 0; i < middlePoints.length; i++) {
    if (middlePoints[i]) {
      left = middlePoints[i]!
      continue
    }
    let right: MHPoint = end
    let rightIndex: number = middlePoints.length
    for (let u = i + 1; u < middlePoints.length; u++) {
      if (middlePoints[u]) {
        right = middlePoints[u]!
        rightIndex = u
        break
      }
    }

    const N = rightIndex - i
    const dx = right.x - left.x
    const dy = right.y - left.y
    for (let t = 1 / (N + 1), ti = 0; ; t += 1 / (N + 1), ti++) {
      if (i + ti === rightIndex) break
      middlePoints[i + ti] = {
        x: left.x + dx * t,
        y: left.y + dy * t,
        xMoves: 0,
        yMoves: 0,
        z1: left.z2,
        z2: left.z2,
      }
    }
  }

  return middlePoints as unknown as MHPoint[]
}

export const constructMiddlePoints = (params: {
  start: MHPoint
  end: MHPoint
  segmentsPerPolyline: number
  viaCount: number
  availableZ: number[]
}) => {
  const { start, end, segmentsPerPolyline, viaCount, availableZ } = params

  const dx = end.x - start.x
  const dy = end.y - start.y

  const middlePoints: MHPoint[] = []

  const viaIndices = createSymmetricArray(segmentsPerPolyline, viaCount)

  let lastZ = start.z1
  const availableZOffset = availableZ.indexOf(start.z1)
  let zFlips = 0
  for (let i = 0; i < segmentsPerPolyline; i++) {
    const isFlipped = viaIndices[i] === 1
    const nextZ = isFlipped
      ? availableZ[(availableZOffset + zFlips + 1) % availableZ.length]
      : lastZ
    const t = (i + 1) / (segmentsPerPolyline + 1)
    const point = {
      x: start.x + t * dx,
      y: start.y + t * dy,
      z1: lastZ,
      z2: nextZ,
      xMoves: 0,
      yMoves: 0,
    }
    lastZ = nextZ
    if (isFlipped) zFlips++
    middlePoints.push(point)
  }

  return middlePoints
}

export const withinBounds = (
  point: MHPoint,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  padding: number = 0,
) => {
  return (
    point.x >= bounds.minX + padding &&
    point.x <= bounds.maxX - padding &&
    point.y >= bounds.minY + padding &&
    point.y <= bounds.maxY - padding
  )
}

export const clonePolyLinesWithMutablePoint = (
  polyLines: PolyLine[],
  lineIndex: number,
  mPointIndex: number,
): [PolyLine[], MHPoint] => {
  const mutablePoint = {
    x: polyLines[lineIndex].mPoints[mPointIndex].x,
    y: polyLines[lineIndex].mPoints[mPointIndex].y,
    xMoves: polyLines[lineIndex].mPoints[mPointIndex].xMoves,
    yMoves: polyLines[lineIndex].mPoints[mPointIndex].yMoves,
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
    [connectionName: string, { start: MHPoint; end: MHPoint }]
  >,
  segmentsPerPolyline: number,
  maxViaCount: number,
  minViaCount: number,
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

  let variants: number[][] = getCombinations(
    possibleViaCountsPerPolyline,
  ).filter((variant) => {
    for (let i = 0; i < variant.length; i++) {
      const viaCount = variant.reduce((acc, count) => acc + count, 0)
      if (viaCount < minViaCount) return false
    }
    return true
  })

  // If a port pair has a z change, it must always have at least 1 via
  variants = variants.filter((variant) => {
    for (let i = 0; i < portPairsEntries.length; i++) {
      const [, portPair1] = portPairsEntries[i]
      if (portPair1.start.z1 !== portPair1.start.z2) {
        if (variant[i] === 0) return false
      }
    }
    return true
  })

  // If two port pairs intersect, the sum of their via counts must be >= 2
  variants = variants.filter((variant) => {
    for (let i = 0; i < portPairsEntries.length; i++) {
      const [, portPair1] = portPairsEntries[i]
      if (portPairsEntries[i][1].start.z1 !== portPairsEntries[i][1].start.z2)
        continue
      for (let j = i + 1; j < portPairsEntries.length; j++) {
        if (portPairsEntries[j][1].start.z1 !== portPairsEntries[j][1].start.z2)
          continue

        const [, portPair2] = portPairsEntries[j]
        if (
          doSegmentsIntersect(
            portPair1.start,
            portPair1.end,
            portPair2.start,
            portPair2.end,
          )
        ) {
          if (variant[i] + variant[j] < 2) return false
        }
      }
    }
    return true
  })

  return variants
}

/**
 * Controls how much smaller neighbor moves are as the total number of moves
 * increases
 */
const moveTaper = (moves: number) => {
  return 1
  // return Math.round(4 - moves / 2)
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

  lastCandidate: Candidate | null = null

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
    this.cellSize = this.nodeWithPortPoints.width / 32

    this.candidates = []
    this.availableZ = this.nodeWithPortPoints.availableZ ?? [0, 1]

    const areaInsideNode =
      this.nodeWithPortPoints.width * this.nodeWithPortPoints.height
    const areaPerVia =
      (this.viaDiameter + this.obstacleMargin * 2 + this.traceWidth / 2) ** 2

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
   * minGaps is a list of distances representing the "gap" between segments
   * on each layer.
   *
   * Each minGaps number represents the gap for a polyline pair, for example if
   * you have 3 polylines, you would have 3 minGaps...
   *
   * [ p1 -> p2 , p1 -> p3, p2 -> p3 ]
   */
  computeMinGapBtwPolyLines(polyLines: PolyLine[]) {
    const minGaps = []
    const polyLineSegmentsByLayer: Array<Map<number, [MHPoint, MHPoint][]>> = []
    const polyLineVias: Array<MHPoint[]> = []
    for (let i = 0; i < polyLines.length; i++) {
      const polyLine = polyLines[i]
      const path = [polyLine.start, ...polyLine.mPoints, polyLine.end]
      const segmentsByLayer: Map<number, [MHPoint, MHPoint][]> = new Map(
        this.availableZ.map((z) => [z, []]),
      )
      for (let i = 0; i < path.length - 1; i++) {
        const segment: [MHPoint, MHPoint] = [path[i], path[i + 1]]
        segmentsByLayer.get(segment[0].z2)!.push(segment)
      }
      polyLineSegmentsByLayer.push(segmentsByLayer)
      polyLineVias.push(path.filter((p) => p.z1 !== p.z2))
    }

    for (let i = 0; i < polyLines.length; i++) {
      const path1SegmentsByLayer = polyLineSegmentsByLayer[i]
      const path1Vias = polyLineVias[i]
      // Start j from i + 1 to compare distinct pairs only once
      for (let j = i + 1; j < polyLines.length; j++) {
        const path2SegmentsByLayer = polyLineSegmentsByLayer[j]
        const path2Vias = polyLineVias[j]

        let minGap = 1
        for (const zLayer of this.availableZ) {
          const path1Segments = path1SegmentsByLayer.get(zLayer) ?? []
          const path2Segments = path2SegmentsByLayer.get(zLayer) ?? []

          // SEGMENT TO SEGMENT DISTANCES
          for (const segment1 of path1Segments) {
            for (const segment2 of path2Segments) {
              minGap = Math.min(
                minGap,
                segmentToSegmentMinDistance(
                  segment1[0],
                  segment1[1],
                  segment2[0],
                  segment2[1],
                ) - this.traceWidth,
              )
            }
          }

          // VIA TO SEGMENT DISTANCES
          for (const via of path1Vias) {
            for (const segment of path2Segments) {
              minGap = Math.min(
                minGap,
                pointToSegmentDistance(via, segment[0], segment[1]) -
                  this.traceWidth / 2 -
                  this.viaDiameter / 2,
              )
            }
          }
          for (const via of path2Vias) {
            for (const segment of path1Segments) {
              minGap = Math.min(
                minGap,
                pointToSegmentDistance(via, segment[0], segment[1]) -
                  this.traceWidth / 2 -
                  this.viaDiameter / 2,
              )
            }
          }

          // VIA TO VIA DISTANCES
          for (const via1 of path1Vias) {
            for (const via2 of path2Vias) {
              minGap = Math.min(minGap, distance(via1, via2) - this.viaDiameter)
            }
          }
        }
        minGaps.push(minGap)
      }
    }
    return minGaps
  }

  /**
   * Unlike most A* solvers with one initial candidate, we create a candidate
   * for each configuration of vias we want to test, this way when computing
   * neighbors we never consider changing layers
   */
  setupInitialPolyLines() {
    const portPairs: Map<string, { start: MHPoint; end: MHPoint }> = new Map()
    this.nodeWithPortPoints.portPoints.forEach((portPoint) => {
      if (!portPairs.has(portPoint.connectionName)) {
        portPairs.set(portPoint.connectionName, {
          start: {
            ...portPoint,
            z1: portPoint.z ?? 0,
            z2: portPoint.z ?? 0,
            xMoves: 0,
            yMoves: 0,
          },
          end: null as any,
        })
      } else {
        portPairs.get(portPoint.connectionName)!.end = {
          ...portPoint,
          z1: portPoint.z ?? 0,
          z2: portPoint.z ?? 0,
          xMoves: 0,
          yMoves: 0,
        }
      }
    })

    const portPairsEntries = Array.from(portPairs.entries())

    const { numSameLayerCrossings, numTransitions } = getIntraNodeCrossings(
      this.nodeWithPortPoints,
    )

    const viaCountVariants = computeViaCountVariants(
      portPairsEntries,
      this.SEGMENTS_PER_POLYLINE,
      this.maxViaCount,
      numSameLayerCrossings * 2 + numTransitions,
    )

    const possibleViaPositions = getPossibleInitialViaPositions({
      portPairsEntries,
      viaCountVariants,
      bounds: this.bounds,
    })

    const possibleViaPositionsWithReorderings = []
    for (const { viaCountVariant, viaPositions } of possibleViaPositions) {
      const viaPositionsWithReorderings = getEveryPossibleOrdering(viaPositions)
      for (const viaPositions of viaPositionsWithReorderings) {
        possibleViaPositionsWithReorderings.push({
          viaCountVariant,
          viaPositions,
        })
      }
    }

    // Convert the portPairs into PolyLines for the initial candidate
    for (const {
      viaPositions,
      viaCountVariant,
    } of possibleViaPositionsWithReorderings) {
      const polyLines: PolyLine[] = []
      let viaPositionIndicesUsed = 0
      for (let i = 0; i < portPairsEntries.length; i++) {
        const [connectionName, portPair] = portPairsEntries[i]
        const viaCount = viaCountVariant[i]
        const viaPositionsForPolyline = viaPositions.slice(
          viaPositionIndicesUsed,
          viaPositionIndicesUsed + viaCount,
        )
        const middlePoints = constructMiddlePointsWithViaPositions({
          start: portPair.start,
          end: portPair.end,
          segmentsPerPolyline: this.SEGMENTS_PER_POLYLINE,
          viaPositions: viaPositionsForPolyline,
          viaCount,
          availableZ: this.availableZ,
        })
        viaPositionIndicesUsed += viaCount

        polyLines.push(
          createPolyLine({
            connectionName,
            start: portPair.start,
            end: portPair.end,
            mPoints: middlePoints,
          }),
        )
      }
      const minGaps = this.computeMinGapBtwPolyLines(polyLines)

      // TODO: Create multiple initial candidates based on viaCountVariants
      // For now, just push the one candidate
      this.candidates.push({
        polyLines,
        hash: computeCandidateHash(polyLines),
        g: 0,
        h: this.computeH({ minGaps }),
        f: 0,
        minGaps,
      })
    }
    // TEMPORARY
    this.candidates = [this.candidates[29]]
  }

  /**
   * g is the cost of each candidate, we consider complexity (deviation from
   * the straight line path for # of operations). This means g increases by
   * 1 from the parent for each operation
   */
  computeG(polyLines: PolyLine[], candidate: Candidate) {
    return candidate.g + 0.5 * this.cellSize
  }

  /**
   * h is the heuristic cost of each candidate. We consider the number of
   * intersections of the polyline and proximity to vias.
   */
  computeH(candidate: Pick<Candidate, "minGaps">) {
    return 0
    let h = 0
    for (const minGap of candidate.minGaps) {
      h -= minGap
    }
    const avgMinGap =
      candidate.minGaps.reduce((acc, minGap) => acc + minGap, 0) /
      candidate.minGaps.length
    return -avgMinGap * 0.1
  }

  /**
   * Mutate the mutablePoint and return true if the operation is valid
   */
  NEIGHBOR_OPERATIONS = [
    (mutablePoint: MHPoint) => {
      const moveSize = Math.max(1, moveTaper(mutablePoint.xMoves))
      mutablePoint.x += this.cellSize * moveSize
      mutablePoint.xMoves++
    },
    (mutablePoint: MHPoint) => {
      const moveSize = Math.max(1, moveTaper(mutablePoint.xMoves))
      mutablePoint.x -= this.cellSize * moveSize
      mutablePoint.xMoves++
    },
    (mutablePoint: MHPoint) => {
      const moveSize = Math.max(1, moveTaper(mutablePoint.yMoves))
      mutablePoint.y += this.cellSize * moveSize
      mutablePoint.yMoves++
    },
    (mutablePoint: MHPoint) => {
      const moveSize = Math.max(1, moveTaper(mutablePoint.yMoves))
      mutablePoint.y -= this.cellSize * moveSize
      mutablePoint.yMoves++
    },
  ]

  getNeighbors(candidate: Candidate): Candidate[] {
    const { polyLines } = candidate
    const numPolyLines = polyLines.length
    const FORCE_MAGNITUDE = this.cellSize * 0.5 // Tunable parameter for force strength
    const VIA_FORCE_MULTIPLIER = 2.0 // Vias push harder
    const EPSILON = 1e-6 // To avoid division by zero

    // 1. Initialize forces for each mPoint
    const forces: Array<Array<{ fx: number; fy: number }>> = Array.from(
      { length: numPolyLines },
      (_, i) =>
        Array.from({ length: polyLines[i].mPoints.length }, () => ({
          fx: 0,
          fy: 0,
        })),
    )

    // 2. Calculate forces between all pairs of points from different polylines
    for (let i = 0; i < numPolyLines; i++) {
      for (let j = i + 1; j < numPolyLines; j++) {
        const polyLine1 = polyLines[i]
        const polyLine2 = polyLines[j]

        const points1 = [polyLine1.start, ...polyLine1.mPoints, polyLine1.end]
        const points2 = [polyLine2.start, ...polyLine2.mPoints, polyLine2.end]

        for (let p1Idx = 0; p1Idx < points1.length; p1Idx++) {
          const p1 = points1[p1Idx]
          const isP1MPoint = p1Idx > 0 && p1Idx < points1.length - 1
          const isVia1 = p1.z1 !== p1.z2
          const layers1 = isVia1 ? [p1.z1, p1.z2] : [p1.z1]

          for (let p2Idx = 0; p2Idx < points2.length; p2Idx++) {
            const p2 = points2[p2Idx]
            const isP2MPoint = p2Idx > 0 && p2Idx < points2.length - 1
            const isVia2 = p2.z1 !== p2.z2
            const layers2 = isVia2 ? [p2.z1, p2.z2] : [p2.z1]

            // Check for interaction: common layers OR one is a via interacting with the other's layer(s)
            const commonLayers = layers1.filter((z) => layers2.includes(z))
            const interact = commonLayers.length > 0

            if (interact) {
              const dx = p1.x - p2.x
              const dy = p1.y - p2.y
              const distSq = dx * dx + dy * dy

              if (distSq > EPSILON) {
                const dist = Math.sqrt(distSq)
                const multiplier = isVia1 || isVia2 ? VIA_FORCE_MULTIPLIER : 1.0
                // Force magnitude inversely proportional to distance (1/dist)
                // Using 1/dist instead of 1/distSq for potentially more stable behavior
                const forceMag = (multiplier * FORCE_MAGNITUDE) / dist

                const fx = (dx / dist) * forceMag
                const fy = (dy / dist) * forceMag

                // Apply force to p1 if it's an mPoint
                if (isP1MPoint) {
                  const mPointIndex1 = p1Idx - 1
                  forces[i][mPointIndex1].fx += fx
                  forces[i][mPointIndex1].fy += fy
                }

                // Apply opposite force to p2 if it's an mPoint
                if (isP2MPoint) {
                  const mPointIndex2 = p2Idx - 1
                  forces[j][mPointIndex2].fx -= fx
                  forces[j][mPointIndex2].fy -= fy
                }
              }
            }
          }
        }
      }
    }

    // 3. Apply forces and create the new neighbor candidate
    // Deep clone polylines to modify them
    const newPolyLines = polyLines.map((pl) => ({
      ...pl,
      mPoints: pl.mPoints.map((mp) => ({ ...mp })),
    }))

    let pointsMoved = false
    for (let i = 0; i < numPolyLines; i++) {
      for (let k = 0; k < newPolyLines[i].mPoints.length; k++) {
        const mPoint = newPolyLines[i].mPoints[k]
        const force = forces[i][k]

        if (Math.abs(force.fx) < EPSILON && Math.abs(force.fy) < EPSILON) {
          continue // No significant force, skip update
        }

        const newX = mPoint.x + force.fx
        const newY = mPoint.y + force.fy

        const isVia = mPoint.z1 !== mPoint.z2
        const radius = isVia ? this.viaDiameter / 2 : this.traceWidth / 2

        // Clamp position within bounds
        const clampedX = Math.max(
          this.bounds.minX + radius,
          Math.min(this.bounds.maxX - radius, newX),
        )
        const clampedY = Math.max(
          this.bounds.minY + radius,
          Math.min(this.bounds.maxY - radius, newY),
        )

        if (
          Math.abs(mPoint.x - clampedX) > EPSILON ||
          Math.abs(mPoint.y - clampedY) > EPSILON
        ) {
          mPoint.x = clampedX
          mPoint.y = clampedY
          // Reset moves count as position is recalculated based on force, not discrete steps
          mPoint.xMoves = 0
          mPoint.yMoves = 0
          pointsMoved = true
        }
      }
      // Recompute hash after potential modifications
      newPolyLines[i].hash = computePolyLineHash(newPolyLines[i])
    }

    // If no points moved significantly, don't generate a redundant neighbor
    if (!pointsMoved) {
      return []
    }

    const neighborHash = computeCandidateHash(newPolyLines)

    // Avoid adding redundant states or cycles
    if (this.queuedCandidateHashes.has(neighborHash)) {
      return []
    }

    const minGaps = this.computeMinGapBtwPolyLines(newPolyLines)
    const g = this.computeG(newPolyLines, candidate) // G might represent something else now, e.g., total displacement or just step count
    const h = this.computeH({ minGaps })
    const newNeighbor: Candidate = {
      polyLines: newPolyLines,
      g,
      h,
      f: g + h,
      hash: neighborHash,
      minGaps,
    }

    this.queuedCandidateHashes.add(neighborHash)

    return [newNeighbor]
  }

  _step() {
    this.candidates.sort((a, b) => a.f - b.f)
    const currentCandidate = this.candidates.shift()!
    if (!currentCandidate) {
      this.failed = true
      return
    }
    this.lastCandidate = currentCandidate
    if (
      currentCandidate.minGaps.every((minGap) => minGap >= this.obstacleMargin)
    ) {
      this.solved = true
      return
    }
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
    const candidateToVisualize = this.lastCandidate ?? this.candidates[0] // Assuming the first is representative
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
