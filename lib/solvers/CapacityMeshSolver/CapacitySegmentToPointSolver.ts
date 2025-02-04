import { BaseSolver } from "../BaseSolver"
import type { NodePortSegment } from "../../types/capacity-edges-to-port-segments-types"
import type { GraphicsObject } from "graphics-debug"

/**
 * CapacitySegmentToPointSolver:
 *
 * In each step, the solver iterates over all unsolved segments (segments
 * without points assigned for each connection). For each segment:
 *
 * - If there is only one connection, it assigns the center as the point.
 * - If there are two connections, it attempts to determine the ordering using
 *   other segments within the node. If no ordering can be determined, it does nothing.
 *
 * If an iteration produces no new assignments, the solver picks the segment with
 * the fewest connections and assigns points evenly spaced along the segment,
 * ordering them alphabetically.
 */
export class CapacitySegmentToPointSolver extends BaseSolver {
  unsolvedSegments: NodePortSegment[]
  solvedSegments: (NodePortSegment & {
    assignedPoints: {
      connectionName: string
      point: { x: number; y: number }
    }[]
  })[]
  colorMap: Record<string, string>

  // We use an extra property on segments to remember assigned points.
  // Each segment will get an added property "assignedPoints" which is an array of:
  // { connectionName: string, point: {x: number, y: number } }
  // This is a temporary extension used by the solver.
  constructor({
    segments,
    colorMap,
  }: { segments: NodePortSegment[]; colorMap?: Record<string, string> }) {
    super()
    this.unsolvedSegments = segments
    this.solvedSegments = []
    this.colorMap = colorMap ?? {}
  }

  /**
   * Perform one iteration step.
   */
  step() {
    let updated = false
    // unsolved segments: segments without complete assignments.
    const unsolved = [...this.unsolvedSegments]

    // Iterate over unsolved segments.
    for (const seg of unsolved) {
      const n = seg.connectionNames.length
      // Already processed? Skip if assignedPoints exists for all connections.
      if ("assignedPoints" in seg && seg.assignedPoints.length === n) continue

      if (n === 1) {
        // For a single connection, assign the center of the segment.
        const center = {
          x: (seg.start.x + seg.end.x) / 2,
          y: (seg.start.y + seg.end.y) / 2,
        }
        seg.assignedPoints = [
          { connectionName: seg.connectionNames[0], point: center },
        ]
        // Move seg from unsolvedSegments to solvedSegments.
        this.unsolvedSegments.splice(this.unsolvedSegments.indexOf(seg), 1)
        this.solvedSegments.push(seg as any)
        updated = true
      } else if (n === 2) {
        // For two connections, attempt to determine a proper ordering by examining
        // other segments within the same node. (This example does not implement a full
        // ordering heuristic; if unclear, leave unassigned to try again later.)
        // You might add additional heuristics here.
        continue
      }
    }

    // If no segments were updated in this iteration, perform a fallback.
    if (!updated && unsolved.length > 0) {
      // Choose the unsolved segment with the fewest connections.
      let candidate = unsolved[0]
      for (const seg of unsolved) {
        if (seg.connectionNames.length < candidate.connectionNames.length) {
          candidate = seg
        }
      }
      // Fallback: assign points evenly spaced along the segment,
      // after sorting connection names alphabetically.
      const sortedConnections = [...candidate.connectionNames].sort()
      const dx = candidate.end.x - candidate.start.x
      const dy = candidate.end.y - candidate.start.y
      const n = sortedConnections.length
      const points = []
      // Evenly space positions using fractions of the segment distance.
      for (let i = 1; i <= n; i++) {
        const fraction = i / (n + 1)
        points.push({
          x: candidate.start.x + dx * fraction,
          y: candidate.start.y + dy * fraction,
        })
      }
      candidate.assignedPoints = sortedConnections.map((conn, idx) => ({
        connectionName: conn,
        point: points[idx],
      }))
      // Move candidate from unsolvedSegments to solvedSegments.
      this.unsolvedSegments.splice(this.unsolvedSegments.indexOf(candidate), 1)
      this.solvedSegments.push(candidate as any)
      updated = true
    }

    // If all segments have been assigned points, mark solved.
    if (this.unsolvedSegments.length === 0) {
      this.solved = true
    }
  }

  /**
   * Continue stepping until the solver is done.
   */
  solve() {
    // To prevent infinite loops, the solver will iterate a maximum number of times.
    let iterations = 0
    const maxIterations = 1000
    while (!this.solved && iterations < maxIterations) {
      const prevUnsolved = this.unsolvedSegments.length
      this.step()
      const currUnsolved = this.unsolvedSegments.length
      // If no progress is made and still unsolved, break to avoid an infinite loop.
      if (prevUnsolved === currUnsolved && !this.solved) break
      iterations++
    }
  }

  /**
   * Return the assigned points for each segment.
   */
  getResults(): Array<{
    segment: NodePortSegment
    assignedPoints: {
      connectionName: string
      point: { x: number; y: number }
    }[]
  }> {
    return this.solvedSegments.map((seg) => ({
      segment: seg,
      assignedPoints: seg.assignedPoints,
    }))
  }

  /**
   * Return a GraphicsObject that visualizes the segments with assigned points.
   */
  visualize(): GraphicsObject {
    return {
      points: this.solvedSegments.flatMap((seg) =>
        seg.assignedPoints.map((ap) => ({
          x: ap.point.x,
          y: ap.point.y,
          label: `${seg.capacityMeshNodeId}-${ap.connectionName}`,
          color: this.colorMap[ap.connectionName],
          step: 4,
        })),
      ),
      lines: this.solvedSegments.map((seg) => ({
        points: [seg.start, seg.end],
        step: 4,
      })),
      rects: [],
      circles: [],
    }
  }
}
