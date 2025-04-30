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
import { cloneAndShuffleArray } from "lib/utils/cloneAndShuffleArray"

export type ConnectionName = string

export interface Segment {
  start: Point3
  end: Point3
  connectionName: string
}

export interface ViaPossibilities2HyperParameters {
  SHUFFLE_SEED?: number
} /**
This solver uses an intersection-based approach. Here's how it works:
0. Prepare placeholderPaths
- Placeholder paths go from (start, end) if the z is the same
- For placeholder paths, if the Z is different between the start and the end, then we create two segments, (start, mid) with start.z and (mid,end) with end.z. This means the placeholder path has four points, the second and third point are both a the mid XY but have a different z
1. We cycle through each port pair, we start by setting currentHead = start for the first pair
2. We have a currentHead, currentPath and currentConnectionName
STEP LOOP:
3. We always try to move the currentHead to the end. We try to create a line from currentHead to the end
4. If the currentHead does any of the following:
   - Intersects a previously created path
   - Intersects a placeholder path
   - (check last) is not on the same z as the end
   Then we must insert a via (2 points with a z change). Insert this via at the midpoint of currentHead and the intersection point (or the end if the "is not same z as end" condition applies)
   In the next iteration of the step function we'll go back to step 3
5. After the currentPath reaches the end for the connection, we delete the placeholder path and select the next currentHead by popping the unprocessedConnections, reset currentPath and set currentConnectionName
6. When there are no more unprocessed connections, we set this.solved = true
*/
export class ViaPossibilitiesSolver2 extends BaseSolver {
  bounds: Bounds
  maxViaCount: number
  portPairMap: PortPairMap
  colorMap: Record<string, string>
  nodeWidth: number
  availableZ: number[]
  hyperParameters: ViaPossibilities2HyperParameters

  unprocessedConnections: ConnectionName[]

  completedPaths: Map<ConnectionName, Point3[]> = new Map()
  placeholderPaths: Map<ConnectionName, Point3[]> = new Map()

  currentHead: Point3
  currentConnectionName: ConnectionName
  currentPath: Point3[]

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

    this.unprocessedConnections = Array.from(this.portPairMap.keys()).sort()
    if (hyperParameters?.SHUFFLE_SEED) {
      this.unprocessedConnections = cloneAndShuffleArray(
        this.unprocessedConnections,
        hyperParameters.SHUFFLE_SEED,
      )
    }

    // Generate placeholder paths
    for (const [connectionName, { start, end }] of this.portPairMap.entries()) {
      if (start.z === end.z) {
        this.placeholderPaths.set(connectionName, [start, end])
      } else {
        // Create a path with a Z change at the midpoint
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        const midStart: Point3 = { x: midX, y: midY, z: start.z }
        const midEnd: Point3 = { x: midX, y: midY, z: end.z }
        this.placeholderPaths.set(connectionName, [
          start,
          midStart,
          midEnd,
          end,
        ])
      }
    }

    this.currentConnectionName = this.unprocessedConnections.pop()!
    this.currentHead = this.portPairMap.get(this.currentConnectionName)!.start
    this.currentPath = [this.currentHead]
    this.placeholderPaths.delete(this.currentConnectionName)
  }

  _step() {}

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
