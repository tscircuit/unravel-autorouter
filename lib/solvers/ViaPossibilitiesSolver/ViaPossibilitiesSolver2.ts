import { NodeWithPortPoints } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import { getBoundsFromNodeWithPortPoints } from "lib/utils/getBoundsFromNodeWithPortPoints"
import {
  Bounds,
  Point,
  Point3,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import { getPortPairMap, PortPairMap } from "lib/utils/getPortPairs"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"

export type ConnectionName = string

export interface Segment {
  start: Point3
  end: Point3
  connectionName: string
}

export interface ViaPossibilities2HyperParameters {
  SHUFFLE_SEED?: number
}

export class ViaPossibilitiesSolver2 extends BaseSolver {
  bounds: Bounds
  maxViaCount: number
  portPairMap: PortPairMap
  colorMap: Record<string, string>
  nodeWidth: number
  availableZ: number[]
  hyperParameters: ViaPossibilities2HyperParameters

  constructor({
    nodeWithPortPoints,
    colorMap,
    hyperParameters,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
    hyperParameters?: ViaPossibilities2HyperParameters
  }) {
    super()
    this.MAX_ITERATIONS = 100e3
    this.colorMap =
      colorMap ?? generateColorMapFromNodeWithPortPoints(nodeWithPortPoints)
    this.maxViaCount = 5
    this.bounds = getBoundsFromNodeWithPortPoints(nodeWithPortPoints)
    this.nodeWidth = this.bounds.maxX - this.bounds.minX
    this.portPairMap = getPortPairMap(nodeWithPortPoints)
    this.stats.solutionsFound = 0
    this.availableZ = nodeWithPortPoints.availableZ ?? [0, 1]
    this.hyperParameters = hyperParameters ?? {
      SHUFFLE_SEED: 0,
    }
  }

  _step() {}

  isCandidatePossible(candidate: Candidate): boolean {
    if (candidate.incompleteHeads.length > 0) return false

    // Check 1: Total number of vias does not exceed the limit
    if (candidate.viaLocationAssignments.size > this.maxViaCount) {
      return false
    }

    // Count vias per connection
    const viasPerConnection = new Map<ConnectionName, number>()
    for (const connectionName of candidate.viaLocationAssignments.values()) {
      viasPerConnection.set(
        connectionName,
        (viasPerConnection.get(connectionName) ?? 0) + 1,
      )
    }

    // Check 2: Transition connection names must have an odd number of vias
    for (const connectionName of this.transitionConnectionNames) {
      const viaCount = viasPerConnection.get(connectionName) ?? 0
      if (viaCount % 2 === 0) {
        // Must have at least one via, and an odd number
        return false
      }
    }

    // Check 3: Same layer connection names must have an even number of vias (or 0)
    for (const connectionName of this.sameLayerConnectionNames) {
      const viaCount = viasPerConnection.get(connectionName) ?? 0
      if (viaCount % 2 !== 0) {
        return false
      }
    }

    // All checks passed
    return true
  }

  visualize(): GraphicsObject {
    const graphics: Required<GraphicsObject> = {
      points: [],
      lines: [],
      circles: [],
      rects: [],
      title: "Via Possibilities Solver State",
      coordinateSystem: "cartesian",
    }

    // Generate a simple color map
    const colorMap = this.colorMap

    // 1. Draw Node Bounds
    graphics.lines!.push({
      points: [
        { x: this.bounds.minX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.minY },
      ],
      strokeColor: "gray",
      strokeWidth: 0.01,
    })

    // 3. Draw Port Pairs (Original Segments)
    for (const [connectionName, { start, end }] of this.portPairMap.entries()) {
      const color = colorMap[connectionName] ?? "black"
      graphics.lines!.push({
        points: [start, end],
        strokeColor: color,
        strokeDash: start.z !== end.z ? "5,5" : undefined,
        label: `${connectionName} (z${start.z}->z${end.z})`,
      })
      graphics.points!.push({
        x: start.x,
        y: start.y,
        color: color,
        label: `${connectionName} Start (z${start.z})`,
      })
      graphics.points!.push({
        x: end.x,
        y: end.y,
        color: color,
        label: `${connectionName} End (z${end.z})`,
      })
    }

    return graphics
  }
}
