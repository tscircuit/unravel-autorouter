import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"

/**
 * AKA a "Stitch Solver", this function "stitches" together high density intra
 * node routes. These routes form one contiguous route that starts NEAR `start`
 * and ends near `end`
 */
export const mergeHighDensityRoutes = (
  hdRoutes: HighDensityIntraNodeRoute[],
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): HighDensityIntraNodeRoute => {}
