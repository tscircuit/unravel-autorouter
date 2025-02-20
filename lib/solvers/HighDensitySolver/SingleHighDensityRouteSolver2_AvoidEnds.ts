import { distance } from "@tscircuit/math-utils"
import {
  SingleHighDensityRouteSolver,
  type Node,
} from "./SingleHighDensityRouteSolver"

export class SingleHighDensityRouteSolver2_AvoidEnds extends SingleHighDensityRouteSolver {
  computeG(node: Node) {
    return (
      (node.parent?.g ?? 0) +
      (node.z === 0 ? 0 : this.viaPenaltyDistance) +
      distance(node, node.parent!)
    )
  }
}
