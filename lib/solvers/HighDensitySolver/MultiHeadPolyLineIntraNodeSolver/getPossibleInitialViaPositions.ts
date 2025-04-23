import type { Bounds, Point } from "@tscircuit/math-utils"
import { getCentroidsFromInnerBoxIntersections } from "./getCentroidsFromInnerBoxIntersections"
import { generateBinaryCombinations } from "./generateBinaryCombinations"

type ViaPositionVariantForLinesViaCountVariant = {
  viaPositions: Point[]
  viaCountVariant: number[]
}

/**
 * Get the all possible via positions if you consider the centroids of shapes
 * created by all the intersections that divide the bounding box of the node
 *
 * We iterate over the via count variants, for each variant we generate each
 * possible via position.
 * Remember: The viaCountVariants specifies the number of vias for each connection,
 * so that's how we know how many points to return
 */
export const getPossibleInitialViaPositions = (params: {
  portPairsEntries: Array<
    [connectionName: string, { start: Point; end: Point }]
  >
  bounds: Bounds
  viaCountVariants: Array<number[]>
}): Array<ViaPositionVariantForLinesViaCountVariant> => {
  const { bounds, portPairsEntries, viaCountVariants } = params

  const { centroids } = getCentroidsFromInnerBoxIntersections(
    bounds,
    portPairsEntries.map(([_, portPair]) => portPair),
  )

  console.log(
    bounds,
    portPairsEntries.map(([_, portPair]) => portPair),
  )
  console.log(centroids)

  const result: ViaPositionVariantForLinesViaCountVariant[] = []

  for (const viaCountVariant of viaCountVariants) {
    const viaCount = viaCountVariant.reduce((acc, count) => acc + count, 0)
    const viaPositionVariants = generateBinaryCombinations(
      viaCount,
      centroids.length,
    )

    for (const viaPositionVariant of viaPositionVariants) {
      for (let i = 0; i < viaPositionVariant.length; i++) {
        const viaPositions: Point[] = []
        if (viaPositionVariant[i] === 1) {
          viaPositions.push(centroids[i])
        }

        result.push({
          viaPositions,
          viaCountVariant,
        })
      }
    }
  }

  return result
}
