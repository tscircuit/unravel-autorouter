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
import { Connect } from "vite"
import { generateColorMapFromNodeWithPortPoints } from "lib/utils/generateColorMapFromNodeWithPortPoints"
import { safeTransparentize } from "../colors"

export type CandidateHash = string
export type ConnectionName = string
export type FaceId = string

export interface Candidate {
  viaLocationAssignments: Map<FaceId, ConnectionName>
  // Each iteration, we move the current heads closer to the end face
  currentHeads: Map<ConnectionName, FaceId>
  headPaths: Map<ConnectionName, FaceId[]> // Added: Track the path of each head
  incompleteHeads: ConnectionName[]
  depth: number
  possible: boolean
  h?: number
  g?: number
  f?: number
}

export const hashCandidate = (candidate: Candidate): CandidateHash => {
  return Array.from(candidate.viaLocationAssignments.entries())
    .sort()
    .join("|")
    .concat("$")
    .concat(Array.from(candidate.currentHeads.entries()).sort().join("|"))
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

export class ViaPossibilitiesSolver extends BaseSolver {
  candidates: Candidate[]
  faces: Map<FaceId, FaceWithSegments>
  faceEdges: Map<FaceId, FaceId[]>
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

  constructor({
    nodeWithPortPoints,
    colorMap,
  }: {
    nodeWithPortPoints: NodeWithPortPoints
    colorMap?: Record<string, string>
  }) {
    super()
    this.MAX_ITERATIONS = 10e3
    this.colorMap =
      colorMap ?? generateColorMapFromNodeWithPortPoints(nodeWithPortPoints)
    this.maxViaCount = 5
    this.exploredCandidateHashes = new Set()
    this.bounds = getBoundsFromNodeWithPortPoints(nodeWithPortPoints)
    this.portPairMap = getPortPairMap(nodeWithPortPoints)

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

    const initialHeads: Map<ConnectionName, FaceId> = new Map()
    for (const [
      connectionName,
      { startFaceId },
    ] of this.connectionEndpointFaceMap.entries()) {
      initialHeads.set(connectionName, startFaceId)
    }

    // Initialize head paths
    const initialHeadPaths: Map<ConnectionName, FaceId[]> = new Map()
    for (const [
      connectionName,
      { startFaceId },
    ] of this.connectionEndpointFaceMap.entries()) {
      initialHeadPaths.set(connectionName, [startFaceId]) // Start path with the initial face
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
    const currentCandidate = this.candidates.pop()
    if (!currentCandidate) {
      this.solved = true
      return
    }
    this.lastCandidate = currentCandidate

    this.candidates.push(...this.getUnexploredNeighbors(currentCandidate))
  }

  isCandidatePossible(candidate: Candidate) {
    if (candidate.incompleteHeads.length > 0) return false
    // TODO check that number of vias does not exceed limit
    // TODO check that transition connection names have odd number of vias
    // TODO check that same layer connection names have even number of vias or 0
  }

  computeG(candidate: Candidate, parent: Candidate) {}

  computeH(candidate: Candidate) {
    // Sum of the distance remaining for each head
  }

  getUnexploredNeighbors(candidate: Candidate): Candidate[] {
    const newCandidates: Candidate[] = []
    for (const incompleteHeadConnName of candidate.incompleteHeads) {
      // Move the incomplete head forward in every possible direction, also consider the placement of any vias
      const currentFaceIdOfIncompleteHead = candidate.currentHeads.get(
        incompleteHeadConnName,
      )!
      const finalFaceIdForHead = this.connectionEndpointFaceMap.get(
        incompleteHeadConnName,
      )!.endFaceId
      const neighborFaceIds = this.faceEdges.get(currentFaceIdOfIncompleteHead)!
      const currentFace = this.faces.get(currentFaceIdOfIncompleteHead)
      const canVia =
        (!currentFace?.requiresViaFromOneOfConnections ||
          currentFace?.requiresViaFromOneOfConnections.includes(
            incompleteHeadConnName,
          )) &&
        !candidate.viaLocationAssignments.has(currentFaceIdOfIncompleteHead)

      // 1. CREATE CANDIDATES TO EACH NEIGHBORING FACE (Move Head)
      for (const neighborFaceId of neighborFaceIds) {
        const newCurrentHeads = new Map(candidate.currentHeads)
        newCurrentHeads.set(incompleteHeadConnName, neighborFaceId)

        // Update head paths
        const newHeadPaths = new Map(candidate.headPaths)
        const currentPath = newHeadPaths.get(incompleteHeadConnName)!
        if (currentPath.includes(neighborFaceId)) continue

        newHeadPaths.set(incompleteHeadConnName, [
          ...currentPath,
          neighborFaceId,
        ])
        const neighbor: Candidate = {
          ...candidate,
          currentHeads: newCurrentHeads,
          headPaths: newHeadPaths,
          depth: candidate.depth + 1,
        }
        if (neighborFaceId === finalFaceIdForHead) {
          neighbor.incompleteHeads = candidate.incompleteHeads.filter(
            (h) => h !== incompleteHeadConnName,
          )
        }
        newCandidates.push(neighbor)
      }

      // 2. IF WE CAN VIA, CREATE CANDIDATE WITH VIA
      if (canVia) {
        const newViaLocationAssignments = new Map(
          candidate.viaLocationAssignments,
        )
        newViaLocationAssignments.set(
          currentFaceIdOfIncompleteHead,
          incompleteHeadConnName,
        ) // Assign via

        // Head paths remain the same when placing a via, only assignments change
        const neighbor: Candidate = {
          ...candidate,
          viaLocationAssignments: newViaLocationAssignments,
          headPaths: new Map(candidate.headPaths), // Ensure a new map instance for hashing
          depth: candidate.depth + 1,
        }
        neighbor.h = newCandidates.push(neighbor)
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
    graphics.lines!.push({
      points: [
        { x: this.bounds.minX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.minY },
        { x: this.bounds.maxX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.maxY },
        { x: this.bounds.minX, y: this.bounds.minY },
      ],
      strokeColor: "gray",
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
        pathFaceIds,
      ] of this.lastCandidate.headPaths.entries()) {
        const color = colorMap[connectionName] ?? "black"
        const portPair = this.portPairMap.get(connectionName)!
        const pathPoints: Point[] = [portPair.start] // Start with the connection start point

        for (const faceId of pathFaceIds) {
          const face = this.faces.get(faceId)
          if (face) {
            pathPoints.push(face.centroid)
          }
        }

        // If the head is complete, add the end point
        if (!this.lastCandidate.incompleteHeads.includes(connectionName)) {
          console.log("adding end point", {
            incompleteHeads: this.lastCandidate.incompleteHeads,
            connectionName,
          })
          pathPoints.push(portPair.end)
        }

        // console.log({ pathPoints })

        graphics.lines!.push({
          points: pathPoints,
          strokeColor: safeTransparentize(color, 0.5),
          strokeWidth: 0.08, // Make path lines thinner than original segments
          strokeDash: [0.05, 0.05], // Dashed to distinguish from original segments
          label: `Path: ${connectionName}`,
        })
      }

      // Draw current heads (optional, can be redundant with paths)
      for (const [
        connectionName,
        faceId,
      ] of this.lastCandidate.currentHeads.entries()) {
        const face = this.faces.get(faceId)
        if (face) {
          const color = colorMap[connectionName] ?? "black"
          graphics.points!.push({
            x: face.centroid.x + 0.01,
            y: face.centroid.y + 0.01,
            color,
            label: `Head: ${connectionName}`,
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
            fill: color,
            stroke: "white",
            label: `Via: ${connectionName}`,
          })
        }
      }
    }
    return graphics
  }
}
