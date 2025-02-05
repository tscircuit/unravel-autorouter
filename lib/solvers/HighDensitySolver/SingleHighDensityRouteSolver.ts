import { BaseSolver } from "../BaseSolver"
import type { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { distance, pointToSegmentDistance } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

type Node = {
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
  A: { x: number; y: number; z: number }
  B: { x: number; y: number; z: number }
  straightLineDistance: number
  viaPenaltyDistance: number

  viaDiameter: number
  traceThickness: number
  obstacleMargin: number
  layerCount: number
  gridSize = 0.05
  GREEDY_MULTIPLER = 1.2

  exploredNodes: Set<string>

  candidates: Node[]

  connectionName: string
  solvedPath: HighDensityIntraNodeRoute | null = null

  constructor(opts: {
    connectionName: string
    obstacleRoutes: HighDensityIntraNodeRoute[]
    A: { x: number; y: number; z: number }
    B: { x: number; y: number; z: number }
    viaDiameter?: number
    traceThickness?: number
    obstacleMargin?: number
    layerCount?: number
  }) {
    super()
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
    this.viaPenaltyDistance = this.gridSize + this.straightLineDistance / 2
    this.MAX_ITERATIONS = 2000

    // TODO should be provided by the caller and be the node size
    const bounds = {
      minX: Math.min(this.A.x, this.B.x),
      maxX: Math.max(this.A.x, this.B.x),
      minY: Math.min(this.A.y, this.B.y),
      maxY: Math.max(this.A.y, this.B.y),
      width: 0,
      height: 0,
    }
    for (const route of this.obstacleRoutes) {
      for (const point of route.route) {
        bounds.minX = Math.min(bounds.minX, point.x)
        bounds.maxX = Math.max(bounds.maxX, point.x)
        bounds.minY = Math.min(bounds.minY, point.y)
        bounds.maxY = Math.max(bounds.maxY, point.y)
      }
    }
    bounds.width = bounds.maxX - bounds.minX
    bounds.height = bounds.maxY - bounds.minY
    const numRoutes = this.obstacleRoutes.length
    const bestRowOrColumnCount = Math.ceil(3 * (numRoutes + 1))
    let numXCells = bounds.width / this.gridSize
    let numYCells = bounds.height / this.gridSize
    while (numXCells * numYCells > bestRowOrColumnCount ** 2) {
      this.gridSize *= 2
      numXCells = bounds.width / this.gridSize
      numYCells = bounds.height / this.gridSize
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

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        if (x === 0 && y === 0) continue

        const neighbor = {
          ...node,
          parent: node,
          x: node.x + x * this.gridSize,
          y: node.y + y * this.gridSize,
        }

        if (
          this.exploredNodes.has(`${neighbor.x},${neighbor.y},${neighbor.z}`)
        ) {
          continue
        }

        if (this.isNodeTooCloseToObstacle(neighbor)) {
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
      this.isNodeTooCloseToObstacle(
        viaNeighbor,
        this.viaDiameter + this.obstacleMargin,
      )
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

    if (distance(currentNode, this.B) <= this.gridSize) {
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
      graphics.lines!.push({
        points: route.route,
        strokeColor: "blue",
        label: "Obstacle Route",
      })
    }

    // Optionally, visualize explored nodes for debugging purposes
    for (const nodeKey of this.exploredNodes) {
      const [x, y, z] = nodeKey.split(",").map(Number)
      graphics.circles!.push({
        center: { x, y },
        fill: "rgba(128,128,128,0.1)",
        radius: this.gridSize / 2,
        label: `Explored (z=${z})`,
      })
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
