import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { Obstacle } from "lib/types"
import { calculate45DegreePaths } from "lib/utils/calculate45DegreePaths"

interface Point {
  x: number
  y: number
  z: number
}

export class SingleSimplifiedPathSolver extends BaseSolver {
  newRoute: HighDensityIntraNodeRoute["route"]
  newVias: HighDensityIntraNodeRoute["vias"]

  headIndex = 0
  tailIndex = 0

  constructor(
    public inputRoute: HighDensityIntraNodeRoute,
    public otherHdRoutes: HighDensityIntraNodeRoute[],
    public obstacles: Obstacle[],
  ) {
    super()
    this.newRoute = []
    this.newVias = []
  }

  isValidPath(pointsInRoute: Point[]): boolean {
    // check that the segments don't intersect with any obstacles or other
    // routes or vias
    // TODO
  }

  _step() {
    // Each iteration, we're going to increase the head and make sure that
    // there's a compatible simplified path from the tail to the head
    // If there isn't a compatible simplified path, we add a segment to the new
    // route from [tail, tail + (head - tail) / 2] then start our next iteration
    // at tail = tail + Math.ceil((head - tail) / 2)
    // If there is a Z change between the tail and the head, we stop the
    // simplification for that segment (add to newRoute and newVias, set tail to
    // head)
  }
}
