import { BaseSolver } from "../BaseSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { Obstacle } from "lib/types"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { pointToSegmentClosestPoint } from "@tscircuit/math-utils"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

export interface ForceShiftViasSolverInput {
  hdRoutes: HighDensityIntraNodeRoute[]
  obstacles: Obstacle[]
  connMap: ConnectivityMap
  layerCount: number
}

const FORCE_BOX_MM = 2
const FORCE_RADIUS = FORCE_BOX_MM / 2 // Radius for checking nearby segments
const FORCE_MAGNITUDE = 0.05

interface Segment {
  p1: { x: number; y: number; z: number }
  p2: { x: number; y: number; z: number }
  routeIndex: number | null // null for obstacle
  connectionName: string | null
  p1Index?: number
  p2Index?: number
}

export class ForceShiftViasSolver extends BaseSolver {
  hdRoutes: HighDensityIntraNodeRoute[]
  obstacles: Obstacle[]
  connMap: ConnectivityMap
  layerCount: number

  constructor(input: ForceShiftViasSolverInput) {
    super()
    this.MAX_ITERATIONS = 1e6
    this.hdRoutes = input.hdRoutes
    this.obstacles = input.obstacles
    this.connMap = input.connMap
    this.layerCount = input.layerCount
  }

  _step() {
    // one shot solver
    if (this.solved) return

    const segments: Segment[] = []
    const forces: Record<
      number,
      Record<number, { fx: number; fy: number }>
    > = {}

    // Build segments from routes
    this.hdRoutes.forEach((route, rIdx) => {
      forces[rIdx] = {}
      for (let i = 0; i < route.route.length - 1; i++) {
        const p1 = route.route[i]
        const p2 = route.route[i + 1]
        segments.push({
          p1,
          p2,
          routeIndex: rIdx,
          connectionName: route.connectionName,
          p1Index: i,
          p2Index: i + 1,
        })
        forces[rIdx][i] = forces[rIdx][i] || { fx: 0, fy: 0 }
        forces[rIdx][i + 1] = forces[rIdx][i + 1] || { fx: 0, fy: 0 }
      }
    })

    // Build segments from obstacles (rect edges on each layer)
    for (const obs of this.obstacles) {
      const zLayers = obs.zLayers
        ? obs.zLayers
        : obs.layers.map((l) => mapLayerNameToZ(l, this.layerCount))
      const halfW = obs.width / 2
      const halfH = obs.height / 2
      const pts = [
        { x: obs.center.x - halfW, y: obs.center.y - halfH },
        { x: obs.center.x + halfW, y: obs.center.y - halfH },
        { x: obs.center.x + halfW, y: obs.center.y + halfH },
        { x: obs.center.x - halfW, y: obs.center.y + halfH },
      ]
      for (const z of zLayers) {
        for (let i = 0; i < 4; i++) {
          const p1 = { x: pts[i].x, y: pts[i].y, z }
          const p2 = { x: pts[(i + 1) % 4].x, y: pts[(i + 1) % 4].y, z }
          segments.push({ p1, p2, routeIndex: null, connectionName: null })
        }
      }
    }

    const radiusSq = FORCE_RADIUS * FORCE_RADIUS

    const addForce = (
      rIdx: number | null,
      pIdx: number | undefined,
      fx: number,
      fy: number,
    ) => {
      if (rIdx === null || pIdx === undefined) return
      const f = forces[rIdx][pIdx]
      if (f) {
        f.fx += fx
        f.fy += fy
      }
    }

    // Compute pairwise forces
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]
        const s2 = segments[j]

        if (s1.p1.z !== s2.p1.z) continue // different layers
        if (
          s1.connectionName &&
          s2.connectionName &&
          this.connMap.areIdsConnected(s1.connectionName, s2.connectionName)
        )
          continue

        const endpoints1 = [
          { pt: s1.p1, idx: s1.p1Index },
          { pt: s1.p2, idx: s1.p2Index },
        ]
        const endpoints2 = [
          { pt: s2.p1, idx: s2.p1Index },
          { pt: s2.p2, idx: s2.p2Index },
        ]

        for (const e1 of endpoints1) {
          const cp = pointToSegmentClosestPoint(e1.pt, s2.p1, s2.p2)
          const dx = e1.pt.x - cp.x
          const dy = e1.pt.y - cp.y
          const dSq = dx * dx + dy * dy
          if (dSq >= radiusSq || dSq === 0) continue
          const dist = Math.sqrt(dSq)
          const mag = ((FORCE_RADIUS - dist) / FORCE_RADIUS) * FORCE_MAGNITUDE
          const fx = (dx / dist) * mag
          const fy = (dy / dist) * mag
          addForce(s1.routeIndex, e1.idx, fx, fy)
          addForce(s2.routeIndex, s2.p1Index, -fx / 2, -fy / 2)
          addForce(s2.routeIndex, s2.p2Index, -fx / 2, -fy / 2)
        }

        for (const e2 of endpoints2) {
          const cp = pointToSegmentClosestPoint(e2.pt, s1.p1, s1.p2)
          const dx = e2.pt.x - cp.x
          const dy = e2.pt.y - cp.y
          const dSq = dx * dx + dy * dy
          if (dSq >= radiusSq || dSq === 0) continue
          const dist = Math.sqrt(dSq)
          const mag = ((FORCE_RADIUS - dist) / FORCE_RADIUS) * FORCE_MAGNITUDE
          const fx = (dx / dist) * mag
          const fy = (dy / dist) * mag
          addForce(s2.routeIndex, e2.idx, fx, fy)
          addForce(s1.routeIndex, s1.p1Index, -fx / 2, -fy / 2)
          addForce(s1.routeIndex, s1.p2Index, -fx / 2, -fy / 2)
        }
      }
    }

    // Apply forces to points
    this.hdRoutes.forEach((route, rIdx) => {
      for (let i = 0; i < route.route.length; i++) {
        const f = forces[rIdx][i]
        if (!f) continue
        route.route[i].x += f.fx
        route.route[i].y += f.fy
      }
    })

    this.solved = true
  }
}
