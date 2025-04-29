import { Bounds } from "@tscircuit/math-utils"
import { NodeWithPortPoints } from "lib/types/high-density-types"
import { getCentroidsFromInnerBoxIntersections } from "./getCentroidsFromInnerBoxIntersections"

interface Point3 {
  x: number
  y: number
  z: number
}

type ConnectionName = string
interface ViaPossibility {
  x: number
  y: number
  connectionNames: ConnectionName[]
}

interface Segment {
  start: Point3
  end: Point3
  connectionName?: string
}

interface ViaPlacement {
  x: number
  y: number
  connectionName: string
}

export const getViaPossibilitiesFromPortPairs = ({
  portPairs,
  availableZ,
  bounds,
  maxViaCount,
  minViaCount,
}: {
  portPairs: Map<ConnectionName, { start: Point3; end: Point3 }>
  availableZ: number[]
  bounds: Bounds
  maxViaCount: number
  minViaCount: number
}): {
  viaPossibilities: ViaPossibility[]
  viaCombinations: Array<ViaPlacement>
} => {
  const zToSegments: Map<number, Array<Segment>> = new Map()
  const zToCentroidResult: Map<
    number,
    ReturnType<typeof getCentroidsFromInnerBoxIntersections>
  > = new Map()

  // STEP 1: Construct Segments
  for (const z of availableZ) {
    const zSegments: Array<Segment> = []
    for (const [connectionName, portPair] of portPairs.entries()) {
      const { start, end } = portPair
      if (start.z === z && end.z === z) {
        zSegments.push({ start, end, connectionName })
      } else if (start.z === z || end.z === z) {
        /* Same layer point */
        const slp = start.z === z ? start : end
        /* Opposite layer point */
        const olp = slp === start ? end : start

        const dx = olp.x - slp.x
        const dy = olp.y - slp.y

        // slp and ending at slt + delta * 3/4
        /* Segment End Point */
        const segEndPoint = { x: slp.x + (dx * 3) / 4, y: slp.y + (dy * 3) / 4 }

        // TODO add to zSegments
      }
    }
  }

  // STEP 2: Find Centroids
  for (const z of availableZ) {
    zToCentroidResult.set(
      z,
      getCentroidsFromInnerBoxIntersections(bounds, zToSegments.get(z)! ?? []),
    )
  }

  // STEP 3: Map Centroids to Via Possibilities
  const viaPossibilities: Array<ViaPossibility> = []
  for (const z of availableZ) {
    const { faces } = zToCentroidResult.get(z)!
    for (const { centroid, vertices } of faces) {
      console.log({ vertices })
    }
  }

  // STEP 4: Create all possible via combinations, taking into consideration min and max via count

  return {
    viaPossibilities: [],
    viaCombinations: [],
  }
}
