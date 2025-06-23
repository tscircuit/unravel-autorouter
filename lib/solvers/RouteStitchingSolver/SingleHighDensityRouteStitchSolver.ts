import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import { distance } from "@tscircuit/math-utils"

export class SingleHighDensityRouteStitchSolver extends BaseSolver {
  mergedHdRoute: HighDensityIntraNodeRoute
  remainingHdRoutes: HighDensityIntraNodeRoute[]
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
  colorMap: Record<string, string>

  constructor(opts: {
    connectionName: string
    hdRoutes: HighDensityIntraNodeRoute[]
    start: { x: number; y: number; z: number }
    end: { x: number; y: number; z: number }
    colorMap?: Record<string, string>
    defaultTraceThickness?: number
    defaultViaDiameter?: number
  }) {
    super()
    this.remainingHdRoutes = [...opts.hdRoutes]
    this.colorMap = opts.colorMap ?? {} // Store colorMap, default to empty object

    if (opts.hdRoutes.length === 0) {
      this.start = opts.start
      this.end = opts.end
      const routePoints = [
        { x: opts.start.x, y: opts.start.y, z: opts.start.z },
      ]
      const vias = []

      if (opts.start.z !== opts.end.z) {
        // If layers are different, add a via at the start point and a segment on the new layer
        routePoints.push({ x: opts.start.x, y: opts.start.y, z: opts.end.z })
        vias.push({ x: opts.start.x, y: opts.start.y })
      }
      routePoints.push({ x: opts.end.x, y: opts.end.y, z: opts.end.z })

      this.mergedHdRoute = {
        connectionName: opts.connectionName,
        route: routePoints,
        vias: vias,
        viaDiameter: opts.defaultViaDiameter ?? 0.6, // Use default or fallback
        traceThickness: opts.defaultTraceThickness ?? 0.15, // Use default or fallback
      }
      this.solved = true
      return // Early exit as there's nothing to stitch
    }

    const { firstRoute } = this.getDisjointedRoute()

    const firstRouteToStartDist = Math.min(
      distance(firstRoute.route[0], opts.start),
      distance(firstRoute.route[firstRoute.route.length - 1], opts.start),
    )
    const firstRouteToEndDist = Math.min(
      distance(firstRoute.route[0], opts.end),
      distance(firstRoute.route[firstRoute.route.length - 1], opts.end),
    )

    if (firstRouteToStartDist < firstRouteToEndDist) {
      this.start = opts.start
      this.end = opts.end
    } else {
      this.start = opts.end
      this.end = opts.start
    }

    this.mergedHdRoute = {
      connectionName: opts.connectionName, // Use mandatory connectionName
      route: [
        {
          x: this.start.x,
          y: this.start.y,
          z: this.start.z,
        },
      ],
      vias: [],
      viaDiameter: firstRoute.viaDiameter,
      traceThickness: firstRoute.traceThickness,
    }
  }

  /**
   * Scan `remainingHdRoutes` and find a route that has **one** end that is not
   * within `5e-6` of the start or end of any other route on the same layer.
   * That “lonely” end marks one extremity of the whole chain, which we use as
   * our starting segment. If no such route exists (e.g., the data form a loop),
   * we simply return the first route so the solver can proceed.
   */
  getDisjointedRoute() {
    const TOL = 5e-6

    for (const candidate of this.remainingHdRoutes) {
      const candidateEnds = [
        candidate.route[0],
        candidate.route[candidate.route.length - 1],
      ]

      // true if at least one end of `candidate` is not matched by any other route
      const hasLonelyEnd = candidateEnds.some((end) => {
        // Look through every *other* route and its two ends
        return !this.remainingHdRoutes.some((other) => {
          if (other === candidate) return false
          const otherEnds = [
            other.route[0],
            other.route[other.route.length - 1],
          ]
          return otherEnds.some(
            (oe) => oe.z === end.z && distance(end, oe) < TOL,
          )
        })
      })

      if (hasLonelyEnd) {
        return { firstRoute: candidate }
      }
    }

    // Degenerate case: everything is paired (forms a loop) – just pick the first route
    return { firstRoute: this.remainingHdRoutes[0] }
  }

  _step() {
    if (this.remainingHdRoutes.length === 0) {
      // Add the end point to the merged route
      this.mergedHdRoute.route.push({
        x: this.end.x,
        y: this.end.y,
        z: this.end.z,
      })
      this.solved = true
      return
    }

    const lastMergedPoint =
      this.mergedHdRoute.route[this.mergedHdRoute.route.length - 1]

    // Find the next logical route to merge
    // 1. We need to check both the first and last points of the remaining routes
    // 2. If the last point is closest, we need to reverse the hd route before merging
    // 3. After merging, we remove it from the remaining routes

    let closestRouteIndex = 0
    let matchedOn: "first" | "last" = "first"
    let closestDistance = Infinity
    for (let i = 0; i < this.remainingHdRoutes.length; i++) {
      const hdRoute = this.remainingHdRoutes[i]
      const lastPointInCandidate = hdRoute.route[hdRoute.route.length - 1]
      const firstPointInCandidate = hdRoute.route[0]
      const distToFirst = distance(lastMergedPoint, firstPointInCandidate)
      const distToLast = distance(lastMergedPoint, lastPointInCandidate)
      if (
        distToFirst < closestDistance &&
        lastMergedPoint.z === firstPointInCandidate.z
      ) {
        closestDistance = distToFirst
        closestRouteIndex = i
        matchedOn = "first"
      }
      if (
        distToLast < closestDistance &&
        lastMergedPoint.z === lastPointInCandidate.z
      ) {
        closestDistance = distToLast
        closestRouteIndex = i
        matchedOn = "last"
      }
    }

    const hdRouteToMerge = this.remainingHdRoutes[closestRouteIndex]
    this.remainingHdRoutes.splice(closestRouteIndex, 1)

    if (matchedOn === "first") {
      this.mergedHdRoute.route.push(...hdRouteToMerge.route)
    } else {
      this.mergedHdRoute.route.push(...[...hdRouteToMerge.route].reverse())
    }

    this.mergedHdRoute.vias.push(...hdRouteToMerge.vias)
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      points: [],
      lines: [],
      circles: [],
      title: "Single High Density Route Stitch Solver",
    }

    // Visualize start and end points
    graphics.points?.push(
      {
        x: this.start.x,
        y: this.start.y,
        color: "green",
        label: "Start",
      },
      {
        x: this.end.x,
        y: this.end.y,
        color: "red",
        label: "End",
      },
    )

    // Visualize the merged HD route in green
    if (this.mergedHdRoute && this.mergedHdRoute.route.length > 1) {
      graphics.lines?.push({
        points: this.mergedHdRoute.route.map((point) => ({
          x: point.x,
          y: point.y,
        })),
        strokeColor: "green",
      })

      // Add points for the merged route
      for (const point of this.mergedHdRoute.route) {
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: "green",
        })
      }

      // Visualize vias in the merged route
      for (const via of this.mergedHdRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: this.mergedHdRoute.viaDiameter / 2,
          fill: "green",
        })
      }
    }

    // Visualize all remaining HD routes using colorMap
    for (const [i, hdRoute] of this.remainingHdRoutes.entries()) {
      const routeColor = this.colorMap[hdRoute.connectionName] ?? "gray" // Default to gray if not in map
      if (hdRoute.route.length > 1) {
        // Create a line for the route
        graphics.lines?.push({
          points: hdRoute.route.map((point) => ({ x: point.x, y: point.y })),
          strokeColor: routeColor,
        })
      }

      // Add points for each route node
      for (let pi = 0; pi < hdRoute.route.length; pi++) {
        const point = hdRoute.route[pi]
        graphics.points?.push({
          x: point.x + ((i % 2) - 0.5) / 500 + ((pi % 8) - 4) / 1000, // Keep slight offset for visibility
          y: point.y + ((i % 2) - 0.5) / 500 + ((pi % 8) - 4) / 1000,
          color: routeColor,
          label: `Route ${hdRoute.connectionName} ${point === hdRoute.route[0] ? "First" : point === hdRoute.route[hdRoute.route.length - 1] ? "Last" : ""}`,
        })
      }

      // Visualize vias
      for (const via of hdRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: hdRoute.viaDiameter / 2,
          fill: routeColor,
        })
      }
    }

    return graphics
  }
}
