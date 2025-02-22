import { CapacityMeshNode } from "lib/types"
import { Obstacle } from "lib/types"
import { BaseSolver } from "../BaseSolver"

export class CapacityNodeTargetMerger extends BaseSolver {
  nodesWithMergedTargets: CapacityMeshNode[]

  constructor(
    public nodes: CapacityMeshNode[],
    public unprocessedObstacles: Obstacle[],
  ) {
    super()
    this.nodesWithMergedTargets = []
  }

  _step() {}
}
