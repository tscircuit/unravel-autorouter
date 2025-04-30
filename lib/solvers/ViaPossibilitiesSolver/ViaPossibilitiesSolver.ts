import { NodeWithPortPoints } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import {
  Face,
  getCentroidsFromInnerBoxIntersections,
} from "../HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getCentroidsFromInnerBoxIntersections"
import { getBoundsFromNodeWithPortPoints } from "lib/utils/getBoundsFromNodeWithPortPoints"
import {
  Bounds,
  Point,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import { getPortPairMap, PortPairMap } from "lib/utils/getPortPairs"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { safeTransparentize } from "../colors"
import { distance } from "@tscircuit/math-utils"

export type CandidateHash = string
export type ConnectionName = string
export type FaceId = string

export interface Candidate {
  viaLocationAssignments: Map<FaceId, ConnectionName>
  // Each iteration, we move the current heads closer to the end face
  currentHeads: Map<ConnectionName, { faceId: FaceId; z: number }>
  headPaths: Map<ConnectionName, { faceId: FaceId; z: number }[]> // Added: Track the path of each head
  incompleteHeads: ConnectionName[]
  depth: number
  possible: boolean
  h?: number
  g?: number
  f?: number
}

export const hashCandidate = (candidate: Candidate): CandidateHash => {
  const viaAssignmentsString = Array.from(
    candidate.viaLocationAssignments.entries(),
  )
    .sort()
    .map(([faceId, connName]) => `${faceId}:${connName}`)
    .join("|")
  const currentHeadsString = Array.from(candidate.currentHeads.entries())
    .sort()
    .map(([connName, { faceId, z }]) => `${connName}:${faceId}@${z}`)
    .join("|")
  return `${viaAssignmentsString}$${currentHeadsString}`
}
export const hashViaLocation = (p: Point) => {
  return `${p.x},${p.y}`
}

export interface FaceWithSegments extends Face {
  segments: Array<{ start: Point; end: Point }>
  requiresViaFromOneOfConnections?: ConnectionName[]
}

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface Segment {
  start: Point3
  end: Point3
  connectionName: string
}

export interface FaceEdge {
  crossesOverConnectionName: ConnectionName
  possibleZOfConnection: number[]
  crossesToFaceId: FaceId
}

export class ViaPossibilitiesSolver extends BaseSolver {
  candidates: Candidate[]
  faces: Map<FaceId, FaceWithSegments>
  faceEdges: Map<FaceId, FaceEdge[]>
  bounds: Bounds
  maxViaCount: number
  portPairMap: PortPairMap
  transitionConnectionNames: ConnectionName[]
  sameLayerConnectionNames: ConnectionName[]
  connectionEndpointFaceMap: Map<
    ConnectionName,
    { startFaceId: FaceId; endFaceId: string }
  >
  exploredCandidateHashes: Set<CandidateHash>
  lastCandidate: Candidate | null
  colorMap: Record<string, string>
  nodeWidth: number
  availableZ: number[]
  GREEDY_MULTIPLIER = 1

  constructor({
    nodeWithPortPoints,
    colorMap,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
  }) {
    super()
    this.MAX_ITERATIONS = 100e3
    this.colorMap =
      colorMap ?? generateColorMapFromNodeWithPortPoints(nodeWithPortPoints)
    this.maxViaCount = 5
    this.exploredCandidateHashes = new Set()
    this.bounds = getBoundsFromNodeWithPortPoints(nodeWithPortPoints)
    this.nodeWidth = this.bounds.maxX - this.bounds.minX
    this.portPairMap = getPortPairMap(nodeWithPortPoints)
    this.stats.solutionsFound = 0
    this.availableZ = nodeWithPortPoints.availableZ ?? [0, 1]

    this.transitionConnectionNames = Array.from(
      this.portPairMap
        .entries()
        .filter(([connectionName, { start, end }]) => start.z !== end.z)
        .map(([connectionName]) => connectionName),
    )
    this.sameLayerConnectionNames = Array.from(
      this.portPairMap
        .entries()
        .filter(([connectionName, { start, end }]) => start.z === end.z)
        .map(([connectionName]) => connectionName),
    )

    const segments: Segment[] = Array.from(this.portPairMap.values())

    const { faces } = getCentroidsFromInnerBoxIntersections(
      this.bounds,
      segments,
    )
    this.faces = new Map()
    for (let i = 0; i < faces.length; i++) {
      const { vertices } = faces[i]
      const segments: Array<{ start: Point; end: Point }> = []
      for (let u = 0; u < vertices.length; u++) {
        segments.push({
          start: vertices[u],
          end: vertices[(u + 1) % vertices.length],
        })
      }

      // A face will require a connection from one of the connections when it contains
      // vertices that show the trace is on the same layer
      let requiresViaFromOneOfConnections: ConnectionName[] | undefined =
        undefined
      const connectionNamesInFace = new Set<string>()
      for (const vertex of vertices) {
        for (const connectionName of vertex.connectionNames ?? []) {
          connectionNamesInFace.add(connectionName)
        }
      }
      const sameLayerConnectionNames = this.sameLayerConnectionNames.filter(
        (cn) => connectionNamesInFace.has(cn),
      )

      if (sameLayerConnectionNames.length > 1) {
        requiresViaFromOneOfConnections = sameLayerConnectionNames
      }

      this.faces.set(`face${i.toString()}`, {
        ...faces[i],
        segments,
        requiresViaFromOneOfConnections,
      })
    }

    this.connectionEndpointFaceMap = new Map()
    for (const [connectionName, { start, end }] of this.portPairMap) {
      // Determine which face is the contains the start or end
      let startFaceId: string | null = null
      let endFaceId: string | null = null
      for (const [faceId, { segments }] of this.faces.entries()) {
        for (const seg of segments) {
          if (
            !startFaceId &&
            pointToSegmentDistance(start, seg.start, seg.end) < 0.001
          ) {
            startFaceId = faceId
            break
          }
          if (
            !endFaceId &&
            pointToSegmentDistance(end, seg.start, seg.end) < 0.001
          ) {
            endFaceId = faceId
            break
          }
        }
        if (startFaceId && endFaceId) break
      }

      if (!startFaceId || !endFaceId) {
        throw new Error(`Could not find face for connection ${connectionName}`)
      }

      this.connectionEndpointFaceMap.set(connectionName, {
        startFaceId,
        endFaceId,
      })
    }

    // Compute face edges. If two faces have a segment to segment min distance of less than 0.001 we consider them
    // to have a shared edge
    this.faceEdges = new Map()
    const faceIds = Array.from(this.faces.keys())

    for (let i = 0; i < faceIds.length; i++) {
      const faceId1 = faceIds[i]
      if (!this.faceEdges.has(faceId1)) this.faceEdges.set(faceId1, [])
      const face1 = this.faces.get(faceId1)!

      for (let j = i + 1; j < faceIds.length; j++) {
        const faceId2 = faceIds[j]
        if (!this.faceEdges.has(faceId2)) this.faceEdges.set(faceId2, [])
        const face2 = this.faces.get(faceId2)!

        let foundSharedEdge = false
        for (const seg1 of face1.segments) {
          for (const seg2 of face2.segments) {
            const dist = segmentToSegmentMinDistance(
              seg1.start,
              seg1.end,
              seg2.start,
              seg2.end,
            )
            if (dist < 0.001) {
              // Add edge in both directions, avoiding duplicates
              if (!this.faceEdges.get(faceId1)!.includes(faceId2)) {
                this.faceEdges.get(faceId1)!.push(faceId2)
              }
              if (!this.faceEdges.get(faceId2)!.includes(faceId1)) {
                this.faceEdges.get(faceId2)!.push(faceId1)
              }
              foundSharedEdge = true
              break // Move to the next face pair once a shared edge is found
            }
          }
          if (foundSharedEdge) break
        }
      }
    }

    // Initialize currentHeads with faceId and starting z-layer
    const initialHeads: Map<ConnectionName, { faceId: FaceId; z: number }> =
      new Map()
    for (const [
      connectionName,
      { startFaceId },
    ] of this.connectionEndpointFaceMap.entries()) {
      const startZ = this.portPairMap.get(connectionName)!.start.z
      initialHeads.set(connectionName, { faceId: startFaceId, z: startZ })
    }

    // Initialize head paths with the starting faceId and z-layer
    const initialHeadPaths: Map<
      ConnectionName,
      { faceId: FaceId; z: number }[]
    > = new Map()
    for (const [connectionName, { faceId, z }] of initialHeads.entries()) {
      initialHeadPaths.set(connectionName, [{ faceId, z }]) // Start path with the initial face and layer
    }

    this.candidates = [
      {
        viaLocationAssignments: new Map(),
        currentHeads: initialHeads,
        headPaths: initialHeadPaths, // Initialize head paths
        incompleteHeads: Array.from(initialHeads.keys()),
        depth: 0,
        possible: false,
      },
    ]
    this.exploredCandidateHashes.add(hashCandidate(this.candidates[0]))
    this.lastCandidate = this.candidates[0]
  }

  _step() {
    const currentCandidate = this.candidates.shift()
    if (!currentCandidate) {
      this.solved = true
      return
    }
    this.lastCandidate = currentCandidate

    if (currentCandidate.incompleteHeads.length === 0) {
      if (this.isCandidatePossible(currentCandidate)) {
        currentCandidate.possible = true
        this.stats.solutionsFound += 1
      }
    }

    this.candidates.push(...this.getUnexploredNeighbors(currentCandidate))
    this.candidates.sort((a, b) => a.f! - b.f!)
  }

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

  computeG(candidate: Candidate, parent: Candidate) {
    const DEPTH_PENALTY_DIST = this.nodeWidth * 0.2
    return candidate.depth * DEPTH_PENALTY_DIST
  }

  computeH(candidate: Candidate) {
    // Sum of the distance remaining for each head
    let distanceSum = 0
    for (const connectionName of candidate.incompleteHeads) {
      const { faceId } = candidate.currentHeads.get(connectionName)!
      const centroid = this.faces.get(faceId)!.centroid
      const end = this.portPairMap.get(connectionName)!.end
      distanceSum += distance(centroid, end) // Heuristic based on 2D distance to target centroid
    }

    const VIA_PENALTY_DIST = this.nodeWidth * 0.2
    distanceSum += candidate.viaLocationAssignments.size * VIA_PENALTY_DIST

    return distanceSum
  }

  getUnexploredNeighbors(candidate: Candidate): Candidate[] {
    const newCandidates: Candidate[] = []
    for (const incompleteHeadConnName of candidate.incompleteHeads) {
      // Move the incomplete head forward in every possible direction, also consider the placement of any vias
      const currentHead = candidate.currentHeads.get(incompleteHeadConnName)!
      const { start: startPort, end: endPort } = this.portPairMap.get(
        incompleteHeadConnName,
      )!
      const finalFaceIdForHead = this.connectionEndpointFaceMap.get(
        incompleteHeadConnName,
      )!.endFaceId
      const neighborFaceIds = this.faceEdges.get(currentHead.faceId)!
      const currentFace = this.faces.get(currentHead.faceId)!

      // Determine if a via can be placed in the current face for this connection
      const canVia =
        // Check if the connection needs to transition layers
        startPort.z !== endPort.z &&
        // Check if the face allows vias for this connection (if restrictions exist)
        (!currentFace.requiresViaFromOneOfConnections ||
          currentFace.requiresViaFromOneOfConnections.includes(
            incompleteHeadConnName,
          )) &&
        !candidate.viaLocationAssignments.has(currentHead.faceId)

      // 1. CREATE CANDIDATES TO EACH NEIGHBORING FACE (Move Head, same Z)
      for (const neighborFaceId of neighborFaceIds) {
        const newCurrentHeads = new Map(candidate.currentHeads)
        // Move head to neighbor face, keep the same Z layer
        newCurrentHeads.set(incompleteHeadConnName, {
          faceId: neighborFaceId,
          z: currentHead.z,
        })

        // Update head paths
        const newHeadPaths = new Map(candidate.headPaths)
        const currentPath = newHeadPaths.get(incompleteHeadConnName)!
        // Prevent cycles by checking if the exact {faceId, z} pair is already in the path
        if (
          currentPath.some(
            (p) => p.faceId === neighborFaceId && p.z === currentHead.z,
          )
        )
          continue

        newHeadPaths.set(incompleteHeadConnName, [
          ...currentPath,
          { faceId: neighborFaceId, z: currentHead.z }, // Add new position to path
        ])
        const neighbor: Candidate = {
          ...candidate, // Copy via assignments etc.
          currentHeads: newCurrentHeads, // Update heads
          headPaths: newHeadPaths,
          depth: candidate.depth + 1,
        }
        if (neighborFaceId === finalFaceIdForHead) {
          neighbor.incompleteHeads = candidate.incompleteHeads.filter(
            (h) => h !== incompleteHeadConnName,
          )
        }
        neighbor.h = this.computeH(neighbor)
        neighbor.g = this.computeG(neighbor, candidate)
        neighbor.f = neighbor.g + neighbor.h * this.GREEDY_MULTIPLIER
        newCandidates.push(neighbor)
      }

      // 2. IF WE CAN VIA, CREATE CANDIDATE WITH VIA (Place Via, change Z)
      if (canVia) {
        const newViaLocationAssignments = new Map(
          candidate.viaLocationAssignments,
        )
        newViaLocationAssignments.set(
          currentHead.faceId,
          incompleteHeadConnName,
        ) // Assign via to this face for this connection

        // Determine the new Z layer after placing the via
        const newZ = currentHead.z === startPort.z ? endPort.z : startPort.z

        // Update current head to reflect the new Z layer in the same face
        const newCurrentHeads = new Map(candidate.currentHeads)
        newCurrentHeads.set(incompleteHeadConnName, {
          faceId: currentHead.faceId,
          z: newZ,
        })

        // Update head path to reflect the layer transition within the same face
        const newHeadPaths = new Map(candidate.headPaths)
        const currentPath = newHeadPaths.get(incompleteHeadConnName)!

        // Prevent cycles: Check if this exact {faceId, z} state was already visited in the path
        if (
          !currentPath.some(
            (p) => p.faceId === currentHead.faceId && p.z === newZ,
          )
        ) {
          newHeadPaths.set(incompleteHeadConnName, [
            ...currentPath,
            { faceId: currentHead.faceId, z: newZ }, // Add via transition step
          ])

          const neighbor: Candidate = {
            ...candidate, // Keep parent's incomplete heads etc.
            viaLocationAssignments: newViaLocationAssignments, // Add the new via assignment
            currentHeads: newCurrentHeads, // Head is now on the new layer
            headPaths: newHeadPaths, // Path reflects the layer change
            depth: candidate.depth + 1,
          }
          neighbor.h = this.computeH(neighbor)
          neighbor.g = this.computeG(neighbor, candidate)
          neighbor.f = neighbor.g + neighbor.h * this.GREEDY_MULTIPLIER
          newCandidates.push(neighbor)
        }
      }
    }

    const unexploredNewCandidates: Candidate[] = []
    for (const newCandidate of newCandidates) {
      const candidateHash = hashCandidate(newCandidate)
      if (this.exploredCandidateHashes.has(candidateHash)) continue
      this.exploredCandidateHashes.add(candidateHash)
      unexploredNewCandidates.push(newCandidate)
    }
    return unexploredNewCandidates
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
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
    const boundaryColor = this.lastCandidate?.possible ? "green" : "gray"
    graphics.lines!.push({
      points: [
        { x: this.bounds.minX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.minY },
      ],
      strokeColor: boundaryColor,
      strokeWidth: 0.05,
    })

    // 2. Draw Faces and Centroids
    for (const [faceId, face] of this.faces.entries()) {
      graphics.points!.push({
        x: face.centroid.x,
        y: face.centroid.y,
        color: "black",
        label: face.requiresViaFromOneOfConnections
          ? `${faceId}\nRequires Via: ${face.requiresViaFromOneOfConnections.join(", ")}`
          : faceId,
      })
      // Removed text push, label is now part of the point
    }

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

    // 4. Visualize Last Candidate State
    if (this.lastCandidate) {
      // Draw Head Paths
      for (const [
        connectionName,
        pathEntries, // Now an array of { faceId: FaceId; z: number }
      ] of this.lastCandidate.headPaths.entries()) {
        const color = colorMap[connectionName] ?? "black"
        const portPair = this.portPairMap.get(connectionName)!
        const pathPoints: Point[] = [portPair.start] // Start with the connection start point

        for (const { faceId } of pathEntries) {
          // Iterate through path entries, extract faceId
          const face = this.faces.get(faceId)
          if (face) {
            pathPoints.push(face.centroid) // Use centroid for visualization
          }
        }

        // If the head is complete, add the end point
        if (!this.lastCandidate.incompleteHeads.includes(connectionName)) {
          pathPoints.push(portPair.end)
        }

        graphics.lines!.push({
          points: pathPoints,
          strokeColor: safeTransparentize(color, 0.5),
          strokeWidth: 0.08, // Make path lines thinner than original segments
          // strokeDash: [0.05, 0.05], // Dashed to distinguish from original segments - REMOVED
          label: `Path: ${connectionName}`,
        })
      }

      // Draw current heads (optional, can be redundant with paths)
      for (const [
        connectionName,
        { faceId, z }, // Destructure faceId and z
      ] of this.lastCandidate.currentHeads.entries()) {
        const face = this.faces.get(faceId)
        if (face) {
          const color = colorMap[connectionName] ?? "black"
          // Add z-layer info to the label
          graphics.points!.push({
            x: face.centroid.x + 0.01,
            y: face.centroid.y + 0.01, // Slight offset for visibility
            color,
            label: `Head: ${connectionName} (z${z})`, // Include z-layer in label
          })
        }
      }

      // Draw assigned vias
      for (const [
        faceId,
        connectionName,
      ] of this.lastCandidate.viaLocationAssignments.entries()) {
        const face = this.faces.get(faceId)
        if (face) {
          const color = colorMap[connectionName] ?? "black"
          graphics.circles!.push({
            center: face.centroid,
            radius: 0.25,
            fill: safeTransparentize(color, 0.5), // Make via fill 50% transparent
            stroke: "white",
            label: `Via: ${connectionName}`,
          })
        }
      }
    }
    return graphics
  }
}
