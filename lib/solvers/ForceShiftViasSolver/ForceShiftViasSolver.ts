import { BaseSolver } from "../BaseSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { Obstacle } from "lib/types"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { pointToSegmentClosestPoint } from "@tscircuit/math-utils"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"

interface Point {
  x: number
  y: number
  z: number
}
interface Segment {
  p1: Point
  p2: Point
  connection: string
  isObstacle?: boolean
}

export const FORCE_SHIFT_BOX_MM = 2

export class ForceShiftViasSolver extends BaseSolver {
  routes: HighDensityIntraNodeRoute[]
  obstacles: Obstacle[]
  connMap: ConnectivityMap
  layerCount: number

  constructor(params: {
    routes: HighDensityIntraNodeRoute[]
    obstacles: Obstacle[]
    connMap: ConnectivityMap
    layerCount: number
  }) {
    super()
    this.routes = params.routes
    this.obstacles = params.obstacles
    this.connMap = params.connMap
    this.layerCount = params.layerCount
  }

  _step() {
    const segments: Segment[] = []
    for (const route of this.routes) {
      for (let i = 0; i < route.route.length - 1; i++) {
        const p1 = route.route[i]
        const p2 = route.route[i + 1]
        segments.push({
          p1: { ...p1 },
          p2: { ...p2 },
          connection: route.connectionName,
        })
      }
    }

    for (const obs of this.obstacles) {
      const zLayers =
        obs.zLayers ??
        obs.layers.map((l) => mapLayerNameToZ(l, this.layerCount))
      const halfW = obs.width / 2
      const halfH = obs.height / 2
      const corners = [
        { x: obs.center.x - halfW, y: obs.center.y - halfH },
        { x: obs.center.x + halfW, y: obs.center.y - halfH },
        { x: obs.center.x + halfW, y: obs.center.y + halfH },
        { x: obs.center.x - halfW, y: obs.center.y + halfH },
      ]
      for (const z of zLayers) {
        segments.push({
          p1: { ...corners[0], z },
          p2: { ...corners[1], z },
          connection: "__obstacle__",
          isObstacle: true,
        })
        segments.push({
          p1: { ...corners[1], z },
          p2: { ...corners[2], z },
          connection: "__obstacle__",
          isObstacle: true,
        })
        segments.push({
          p1: { ...corners[2], z },
          p2: { ...corners[3], z },
          connection: "__obstacle__",
          isObstacle: true,
        })
        segments.push({
          p1: { ...corners[3], z },
          p2: { ...corners[0], z },
          connection: "__obstacle__",
          isObstacle: true,
        })
      }
    }

    const points: Array<{ point: Point; routeIdx: number; pointIdx: number }> =
      []
    for (let r = 0; r < this.routes.length; r++) {
      const route = this.routes[r]
      for (let i = 1; i < route.route.length - 1; i++) {
        points.push({ point: route.route[i], routeIdx: r, pointIdx: i })
      }
    }

    const netForces = new Array(points.length)
      .fill(0)
      .map(() => ({ fx: 0, fy: 0 }))
    const FORCE_MAGNITUDE = 0.02
    const FORCE_DECAY_RATE = 6

    for (let pIdx = 0; pIdx < points.length; pIdx++) {
      const { point, routeIdx } = points[pIdx]
      for (const seg of segments) {
        if (
          seg.connection !== "__obstacle__" &&
          seg.connection === this.routes[routeIdx].connectionName
        )
          continue
        if (
          seg.connection !== "__obstacle__" &&
          this.connMap.areIdsConnected(
            this.routes[routeIdx].connectionName,
            seg.connection,
          )
        )
          continue
        if (point.z !== seg.p1.z || point.z !== seg.p2.z) continue
        const cp = pointToSegmentClosestPoint(point, seg.p1, seg.p2)
        const dx = point.x - cp.x
        const dy = point.y - cp.y
        const distSq = dx * dx + dy * dy
        if (distSq === 0) continue
        const dist = Math.sqrt(distSq)
        if (dist > FORCE_SHIFT_BOX_MM) continue
        const mag = FORCE_MAGNITUDE * Math.exp(-FORCE_DECAY_RATE * dist)
        netForces[pIdx].fx += (dx / dist) * mag
        netForces[pIdx].fy += (dy / dist) * mag
      }
    }

    for (let i = 0; i < points.length; i++) {
      const { point, routeIdx, pointIdx } = points[i]
      const fx = netForces[i].fx
      const fy = netForces[i].fy
      if (fx === 0 && fy === 0) continue
      const prev = this.routes[routeIdx].route[pointIdx - 1]
      const next = this.routes[routeIdx].route[pointIdx + 1]
      const movedPoint = { x: point.x + fx, y: point.y + fy, z: point.z }
      const distPrev = Math.hypot(movedPoint.x - prev.x, movedPoint.y - prev.y)
      if (distPrev > FORCE_SHIFT_BOX_MM) {
        const ratio = FORCE_SHIFT_BOX_MM / distPrev
        const boundary = {
          x: prev.x + (movedPoint.x - prev.x) * ratio,
          y: prev.y + (movedPoint.y - prev.y) * ratio,
          z: point.z,
        }
        this.routes[routeIdx].route.splice(pointIdx, 0, boundary)
        points.splice(i, 0, { point: boundary, routeIdx, pointIdx })
        netForces.splice(i, 0, { fx: 0, fy: 0 })
        i++
      }
      const distNext = Math.hypot(movedPoint.x - next.x, movedPoint.y - next.y)
      if (distNext > FORCE_SHIFT_BOX_MM) {
        const ratio = FORCE_SHIFT_BOX_MM / distNext
        const boundary = {
          x: movedPoint.x + (next.x - movedPoint.x) * ratio,
          y: movedPoint.y + (next.y - movedPoint.y) * ratio,
          z: point.z,
        }
        this.routes[routeIdx].route.splice(pointIdx + 1, 0, boundary)
        points.splice(i + 1, 0, {
          point: boundary,
          routeIdx,
          pointIdx: pointIdx + 1,
        })
        netForces.splice(i + 1, 0, { fx: 0, fy: 0 })
      }
      point.x = movedPoint.x
      point.y = movedPoint.y
    }

    this.solved = true
  }
}
