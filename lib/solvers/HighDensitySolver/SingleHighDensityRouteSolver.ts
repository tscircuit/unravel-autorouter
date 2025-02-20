import { BaseSolver } from "../BaseSolver"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import {
  distance,
  pointToSegmentDistance,
  doSegmentsIntersect,
} from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

export type Node = {
  x: number
  y: number
  z: number

  g: number
  h: number
  f: number

  parent: Node | null
}

export class SingleHighDensityRouteSolver extends BaseSolver {
  obstacleRoutes: HighDensityIntraNodeRoute[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  boundsSize: { width: number; height: number }
  boundsCenter: { x: number; y: number }
  A: { x: number; y: number; z: number }
  B: { x: number; y: number; z: number }
  straightLineDistance: number
  viaPenaltyDistance: number

  viaDiameter: number
  traceThickness: number
  obstacleMargin: number
  layerCount: number
  minCellSize = 0.05
  cellStep = 0.05
  GREEDY_MULTIPLER = 1.2

  exploredNodes: Set<string>

  candidates: Node[]

  connectionName: string
  solvedPath: HighDensityIntraNodeRoute | null = null

  constructor(opts: {
    connectionName: string
    obstacleRoutes: HighDensityIntraNodeRoute[]
    node: { center: { x: number; y: number }; width: number; height: number }
    A: { x: number; y: number; z: number }
    B: { x: number; y: number; z: number }
    viaDiameter?: number
    traceThickness?: number
    obstacleMargin?: number
    layerCount?: number
  }) {
    super()
    this.bounds = {
      minX: opts.node.center.x - opts.node.width / 2,
      maxX: opts.node.center.x + opts.node.width / 2,
      minY: opts.node.center.y - opts.node.height / 2,
      maxY: opts.node.center.y + opts.node.height / 2,
    }
    this.boundsSize = {
      width: this.bounds.maxX - this.bounds.minX,
      height: this.bounds.maxY - this.bounds.minY,
    }
    this.boundsCenter = {
      x: (this.bounds.minX + this.bounds.maxX) / 2,
      y: (this.bounds.minY + this.bounds.maxY) / 2,
    }
    this.connectionName = opts.connectionName
    this.obstacleRoutes = opts.obstacleRoutes
    this.A = opts.A
    this.B = opts.B
    this.viaDiameter = opts.viaDiameter ?? 0.6
    this.traceThickness = opts.traceThickness ?? 0.15
    this.obstacleMargin = opts.obstacleMargin ?? 0.1
    this.layerCount = opts.layerCount ?? 2
    this.exploredNodes = new Set()
    this.candidates = [
      {
        ...opts.A,
        z: 0,
        g: 0,
        h: 0,
        f: 0,
        parent: null,
      },
    ]
    this.straightLineDistance = distance(this.A, this.B)
    this.viaPenaltyDistance = this.cellStep + this.straightLineDistance / 2
    this.MAX_ITERATIONS = 2000

    const numRoutes = this.obstacleRoutes.length
    const bestRowOrColumnCount = Math.ceil(5 * (numRoutes + 1))
    let numXCells = this.boundsSize.width / this.cellStep
    let numYCells = this.boundsSize.height / this.cellStep
    while (numXCells * numYCells > bestRowOrColumnCount ** 2) {
      this.cellStep *= 2
      numXCells = this.boundsSize.width / this.cellStep
      numYCells = this.boundsSize.height / this.cellStep
    }
  }

  isNodeTooCloseToObstacle(node: Node, margin?: number) {
    margin ??= this.obstacleMargin
    for (const route of this.obstacleRoutes) {
      const pointPairs = getSameLayerPointPairs(route)
      for (const pointPair of pointPairs) {
        if (
          pointPair.z === node.z &&
          pointToSegmentDistance(node, pointPair.A, pointPair.B) <
            this.traceThickness + margin
        ) {
          return true
        }
      }
      for (const via of route.vias) {
        if (distance(node, via) < this.viaDiameter + margin) {
          return true
        }
      }
    }

    return false
  }

  isNodeTooCloseToEdge(node: Node) {
    const viaRadius = this.viaDiameter / 2
    return (
      node.x - viaRadius < this.bounds.minX + viaRadius ||
      node.x + viaRadius > this.bounds.maxX - viaRadius ||
      node.y - viaRadius < this.bounds.minY + viaRadius ||
      node.y + viaRadius > this.bounds.maxY - viaRadius
    )
  }

  doesPathToParentIntersectObstacle(node: Node) {
    const parent = node.parent
    if (!parent) return false
    for (const route of this.obstacleRoutes) {
      for (const pointPair of getSameLayerPointPairs(route)) {
        if (pointPair.z !== node.z) continue
        if (doSegmentsIntersect(node, parent, pointPair.A, pointPair.B)) {
          return true
        }
      }
    }
    return false
  }

  computeH(node: Node) {
    return (
      distance(node, this.B) +
      // via penalty
      Math.abs(node.z - this.B.z) * this.viaPenaltyDistance
    )
  }

  computeG(node: Node) {
    return (
      (node.parent?.g ?? 0) +
      (node.z === 0 ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)
    )
  }

  computeF(g: number, h: number) {
    return g + h * this.GREEDY_MULTIPLER
  }

  getNeighbors(node: Node) {
    const neighbors: Node[] = []

    const { maxX, minX, maxY, minY } = this.bounds

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        if (x === 0 && y === 0) continue

        const neighbor = {
          ...node,
          parent: node,
          x: clamp(node.x + x * this.cellStep, minX, maxX),
          y: clamp(node.y + y * this.cellStep, minY, maxY),
        }

        if (
          this.exploredNodes.has(`${neighbor.x},${neighbor.y},${neighbor.z}`)
        ) {
          continue
        }

        if (this.isNodeTooCloseToObstacle(neighbor)) {
          continue
        }

        if (this.doesPathToParentIntersectObstacle(neighbor)) {
          continue
        }

        neighbor.g = this.computeG(neighbor)
        neighbor.h = this.computeH(neighbor)
        neighbor.f = this.computeF(neighbor.g, neighbor.h)

        neighbors.push(neighbor)
      }
    }

    const viaNeighbor = {
      ...node,
      parent: node,
      z: node.z === 0 ? this.layerCount - 1 : 0,
    }

    if (
      !this.exploredNodes.has(
        `${viaNeighbor.x},${viaNeighbor.y},${viaNeighbor.z}`,
      ) &&
      !this.isNodeTooCloseToObstacle(
        viaNeighbor,
        this.viaDiameter + this.obstacleMargin,
      ) &&
      !this.isNodeTooCloseToEdge(viaNeighbor)
    ) {
      viaNeighbor.g = this.computeG(viaNeighbor)
      viaNeighbor.h = this.computeH(viaNeighbor)
      viaNeighbor.f = this.computeF(viaNeighbor.g, viaNeighbor.h)

      neighbors.push(viaNeighbor)
    }

    return neighbors
  }

  setSolvedPath(node: Node) {
    const path: Node[] = []
    while (node) {
      path.push(node)
      node = node.parent!
    }
    path.reverse()

    const vias: { x: number; y: number }[] = []
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i].z !== path[i + 1].z) {
        vias.push({ x: path[i].x, y: path[i].y })
      }
    }

    this.solvedPath = {
      connectionName: this.connectionName,
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      route: path
        .map((node) => ({ x: node.x, y: node.y, z: node.z }))
        .concat([this.B]),
      vias,
    }
  }

  step() {
    this.candidates.sort((a, b) => b.f - a.f)
    let currentNode = this.candidates.pop()

    while (
      currentNode &&
      this.exploredNodes.has(
        `${currentNode.x},${currentNode.y},${currentNode.z}`,
      )
    ) {
      currentNode = this.candidates.pop()
    }

    if (!currentNode) {
      // No more candidates, we've failed :(
      return
    }
    this.exploredNodes.add(`${currentNode.x},${currentNode.y},${currentNode.z}`)

    if (distance(currentNode, this.B) <= this.cellStep) {
      this.solved = true
      this.setSolvedPath(currentNode)
    }

    const neighbors = this.getNeighbors(currentNode)
    for (const neighbor of neighbors) {
      this.candidates.push(neighbor)
    }
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Display the input port points (from nodeWithPortPoints via A and B)
    graphics.points!.push({
      x: this.A.x,
      y: this.A.y,
      label: "Input A",
      color: "orange",
    })
    graphics.points!.push({
      x: this.B.x,
      y: this.B.y,
      label: "Input B",
      color: "orange",
    })

    // Draw a line representing the direct connection between the input port points
    graphics.lines!.push({
      points: [this.A, this.B],
      strokeColor: "rgba(255, 0, 0, 0.5)",
      label: "Direct Input Connection",
    })

    // Show any obstacle routes as background references
    for (const route of this.obstacleRoutes) {
      for (let i = 0; i < route.route.length - 1; i++) {
        const z = route.route[i].z
        graphics.lines!.push({
          points: [route.route[i], route.route[i + 1]],
          strokeColor:
            z === 0 ? "rgba(255, 0, 0, 0.75)" : "rgba(255, 128, 0, 0.25)",
          strokeWidth: route.traceThickness,
          label: "Obstacle Route",
        })
      }
    }

    // Optionally, visualize explored nodes for debugging purposes
    for (const nodeKey of this.exploredNodes) {
      const [x, y, z] = nodeKey.split(",").map(Number)
      graphics.circles!.push({
        center: { x, y },
        fill: z === 0 ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)",
        radius: this.cellStep / 2,
        label: `Explored (z=${z})`,
      })
    }

    // Visualize vias from obstacle routes
    for (const route of this.obstacleRoutes) {
      for (const via of route.vias) {
        graphics.circles!.push({
          center: {
            x: via.x,
            y: via.y,
          },
          radius: this.viaDiameter / 2,
          fill: "rgba(255, 0, 0, 0.5)",
          label: "Via",
        })
      }
    }
    // If a solved route exists, display it along with via markers
    if (this.solvedPath) {
      graphics.lines!.push({
        points: this.solvedPath.route,
        strokeColor: "green",
        label: "Solved Route",
      })
      for (const via of this.solvedPath.vias) {
        graphics.circles!.push({
          center: via,
          radius: this.viaDiameter / 2,
          fill: "green",
          label: "Via",
        })
      }
    }

    return graphics
  }
}

function getSameLayerPointPairs(route: HighDensityIntraNodeRoute) {
  const pointPairs: {
    z: number
    A: { x: number; y: number; z: number }
    B: { x: number; y: number; z: number }
  }[] = []

  for (let i = 0; i < route.route.length - 1; i++) {
    if (route.route[i].z === route.route[i + 1].z) {
      pointPairs.push({
        z: route.route[i].z,
        A: route.route[i],
        B: route.route[i + 1],
      })
    }
  }

  return pointPairs
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}
