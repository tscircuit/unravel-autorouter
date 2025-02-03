import { BaseSolver } from "../BaseSolver"
import type {
  CapacityMeshEdge,
  CapacityMeshNode,
  CapacityMeshNodeId,
  CapacityPath,
  SimpleRouteConnection,
  SimpleRouteJson,
} from "../../types"
import type { GraphicsObject } from "../../types/graphics-debug-types"
import { getNodeEdgeMap } from "./getNodeEdgeMap"

type Candidate = {
  prevCandidate: Candidate | null
  node: CapacityMeshNode
  f: number
  g: number
  h: number
}

export class CapacityPathingSolver extends BaseSolver {
  connectionsWithNodes: Array<{
    connection: SimpleRouteConnection
    nodes: CapacityMeshNode[]
    path?: CapacityMeshNode[]
  }>

  remainingNodeCapacityMap: Map<CapacityMeshNodeId, number>

  simpleRouteJson: SimpleRouteJson
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
  getCapacity: (node: CapacityMeshNode) => number

  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>
  nodeEdgeMap: Map<CapacityMeshNodeId, CapacityMeshEdge[]>

  constructor({
    simpleRouteJson,
    nodes,
    edges,
    getCapacity,
  }: {
    simpleRouteJson: SimpleRouteJson
    nodes: CapacityMeshNode[]
    edges: CapacityMeshEdge[]
    getCapacity?: (node: CapacityMeshNode) => number
  }) {
    super()
    this.simpleRouteJson = simpleRouteJson
    this.nodes = nodes
    this.edges = edges
    this.getCapacity = getCapacity ?? createDepthBasedCapacityGetter(nodes)
    this.connectionsWithNodes = this.getConnectionsWithNodes()
    this.remainingNodeCapacityMap = new Map(
      this.nodes.map((node) => [
        node.capacityMeshNodeId,
        this.getCapacity(node),
      ]),
    )
    this.nodeMap = new Map(
      this.nodes.map((node) => [node.capacityMeshNodeId, node]),
    )
    this.nodeEdgeMap = getNodeEdgeMap(this.edges)
  }

  getConnectionsWithNodes() {
    const connectionsWithNodes: Array<{
      connection: SimpleRouteConnection
      nodes: CapacityMeshNode[]
      pathFound: boolean
    }> = []
    const nodesWithTargets = this.nodes.filter((node) => node._containsTarget)

    for (const connection of this.simpleRouteJson.connections) {
      const nodesForConnection: CapacityMeshNode[] = []
      for (const point of connection.pointsToConnect) {
        let closestNode = this.nodes[0]
        let minDistance = Number.MAX_VALUE

        for (const node of nodesWithTargets) {
          const distance = Math.sqrt(
            (node.center.x - point.x) ** 2 + (node.center.y - point.y) ** 2,
          )
          if (distance < minDistance) {
            minDistance = distance
            closestNode = node
          }
        }
        nodesForConnection.push(closestNode)
      }
      if (nodesForConnection.length < 2) {
        throw new Error(
          `Not enough nodes for connection "${connection.name}", only ${nodesForConnection.length} found`,
        )
      }
      connectionsWithNodes.push({
        connection,
        nodes: nodesForConnection,
        pathFound: false,
      })
    }
    return connectionsWithNodes
  }

  currentConnectionIndex = 0

  candidates?: Array<Candidate> | null
  visitedNodes?: Set<CapacityMeshNodeId> | null

  computeG(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    return (
      prevCandidate.g +
      Math.sqrt(
        (node.center.x - prevCandidate.node.center.x) ** 2 +
          (node.center.y - prevCandidate.node.center.y) ** 2,
      )
    )
  }

  computeH(
    prevCandidate: Candidate,
    node: CapacityMeshNode,
    endGoal: CapacityMeshNode,
  ) {
    return Math.sqrt(
      (node.center.x - endGoal.center.x) ** 2 +
        (node.center.y - endGoal.center.y) ** 2,
    )
  }

  getBacktrackedPath(candidate: Candidate) {
    const path: CapacityMeshNode[] = []
    let currentCandidate = candidate
    while (currentCandidate) {
      path.push(currentCandidate.node)
      currentCandidate = currentCandidate.prevCandidate!
    }
    return path
  }

  getNeighboringNodes(node: CapacityMeshNode) {
    return this.nodeEdgeMap
      .get(node.capacityMeshNodeId)!
      .flatMap((edge): CapacityMeshNodeId[] =>
        edge.nodeIds.filter((n) => n !== node.capacityMeshNodeId),
      )
      .map((n) => this.nodeMap.get(n)!)
  }

  getCapacityPaths() {
    const capacityPaths: CapacityPath[] = []
    for (const connection of this.connectionsWithNodes) {
      const path = connection.path
      if (path) {
        capacityPaths.push({
          capacityPathId: connection.connection.name,
          connectionName: connection.connection.name,
          nodeIds: path.map((node) => node.capacityMeshNodeId),
        })
      }
    }
    return capacityPaths
  }

  step() {
    const nextConnection =
      this.connectionsWithNodes[this.currentConnectionIndex]
    if (!nextConnection) {
      this.solved = true
      return
    }
    const [start, end] = nextConnection.nodes
    if (!this.candidates) {
      this.candidates = [{ prevCandidate: null, node: start, f: 0, g: 0, h: 0 }]
      this.visitedNodes = new Set([start.capacityMeshNodeId])
    }

    this.candidates.sort((a, b) => a.f - b.f)
    const currentCandidate = this.candidates.shift()
    if (!currentCandidate) {
      throw new Error(
        `Ran out of candidates on connection ${nextConnection.connection.name}`,
      )
    }
    if (currentCandidate.node.capacityMeshNodeId === end.capacityMeshNodeId) {
      nextConnection.path = this.getBacktrackedPath(currentCandidate)

      for (const node of nextConnection.path) {
        this.remainingNodeCapacityMap.set(
          node.capacityMeshNodeId,
          this.remainingNodeCapacityMap.get(node.capacityMeshNodeId)! - 1,
        )
      }
      this.currentConnectionIndex++
      this.candidates = null
      this.visitedNodes = null
      return
    }

    const neighborNodes = this.getNeighboringNodes(currentCandidate.node)
    for (const neighborNode of neighborNodes) {
      if (this.visitedNodes?.has(neighborNode.capacityMeshNodeId)) {
        continue
      }
      const neighborNodeCapacity =
        this.remainingNodeCapacityMap.get(neighborNode.capacityMeshNodeId) ?? 0
      if (neighborNodeCapacity <= 0) {
        continue
      }
      const g = this.computeG(currentCandidate, neighborNode, end)
      const h = this.computeH(currentCandidate, neighborNode, end)
      const f = g + h
      const newCandidate = {
        prevCandidate: currentCandidate,
        node: neighborNode,
        f,
        g,
        h,
      }
      this.candidates.push(newCandidate)
    }
    this.visitedNodes!.add(currentCandidate.node.capacityMeshNodeId)
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Visualize each solved connection path (draw a line through each node's center)
    if (this.connectionsWithNodes) {
      for (let i = 0; i < this.connectionsWithNodes.length; i++) {
        const conn = this.connectionsWithNodes[i]
        if (conn.path && conn.path.length > 0) {
          const pathPoints = conn.path
            .map((node) => node.center)
            .map(({ x, y }) => ({
              // slight offset to allow viewing overlapping paths
              x: x + i * 0.1,
              y: y + i * 0.1,
            }))
          graphics.lines!.push({
            points: pathPoints,
          })
        }
      }
    }

    for (const node of this.nodes) {
      graphics.rects!.push({
        center: node.center,
        width: node.width - 2,
        height: node.height - 2,
        fill: node._containsObstacle ? "rgba(255,0,0,0.1)" : "rgba(0,0,0,0.1)",
        label: `${this.remainingNodeCapacityMap.get(node.capacityMeshNodeId)}/${node.totalCapacity}`,
      })
    }

    // Visualize connection points from each connection as circles
    if (this.connectionsWithNodes) {
      for (const conn of this.connectionsWithNodes) {
        if (conn.connection?.pointsToConnect) {
          for (const point of conn.connection.pointsToConnect) {
            graphics.points!.push({
              x: point.x,
              y: point.y,
            })
          }
        }
      }
    }

    return graphics
  }
}

function createDepthBasedCapacityGetter(nodes: CapacityMeshNode[]) {
  const maxDepth = Math.max(...nodes.map((node) => node._depth ?? 0))
  return (node: CapacityMeshNode) => {
    const depth = node._depth ?? 0
    return (maxDepth - depth + 1) ** 2
  }
}
