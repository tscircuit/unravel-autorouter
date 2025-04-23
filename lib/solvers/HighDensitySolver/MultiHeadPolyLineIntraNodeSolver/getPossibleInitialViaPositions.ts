import type { Bounds, Point } from "@tscircuit/math-utils"

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
}): Array<{
  viaPositionsForEachLine: Array<{
    viaPositions: Point[]
  }>
  viaCountVariant: number[]
}> => {
  // TODO
}
