import {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"
import { SingleIntraNodeRouteSolver } from "../HighDensitySolver/SingleIntraNodeRouteSolver"
import {
  HyperParameterSupervisorSolver,
  SupervisedSolver,
} from "../HyperParameterSupervisorSolver"

export class HyperSingleIntraNodeSolver extends HyperParameterSupervisorSolver<SingleIntraNodeRouteSolver> {
  constructorParams: ConstructorParameters<typeof SingleIntraNodeRouteSolver>[0]
  solvedRoutes: HighDensityIntraNodeRoute[] = []
  nodeWithPortPoints: NodeWithPortPoints

  constructor(
    opts: ConstructorParameters<typeof SingleIntraNodeRouteSolver>[0],
  ) {
    super()
    this.nodeWithPortPoints = opts.nodeWithPortPoints
    this.constructorParams = opts
    this.MAX_ITERATIONS = 100_000
    this.GREEDY_MULTIPLIER = 5
    this.MIN_SUBSTEPS = 100
  }

  getHyperParameterDefs() {
    return [
      {
        name: "majorCombinations",
        possibleValues: [
          {
            FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR: 2,
            FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR: 1,
            FUTURE_CONNECTION_PROXIMITY_VD: 10,
            MISALIGNED_DIST_PENALTY_FACTOR: 5,
          },
          {
            FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR: 1,
            FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR: 0.5,
            FUTURE_CONNECTION_PROXIMITY_VD: 5,
            MISALIGNED_DIST_PENALTY_FACTOR: 2,
          },
          {
            FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR: 10,
            FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR: 1,
            FUTURE_CONNECTION_PROXIMITY_VD: 5,
            MISALIGNED_DIST_PENALTY_FACTOR: 10,
            VIA_PENALTY_FACTOR_2: 1,
          },
        ],
      },
      {
        name: "orderings",
        possibleValues: [
          {
            SHUFFLE_SEED: 0,
          },
          {
            SHUFFLE_SEED: 1,
          },
          {
            SHUFFLE_SEED: 2,
          },
          {
            SHUFFLE_SEED: 3,
          },
          {
            SHUFFLE_SEED: 4,
          },
          {
            SHUFFLE_SEED: 5,
          },
          {
            SHUFFLE_SEED: 6,
          },
          {
            SHUFFLE_SEED: 7,
          },
        ],
      },
      {
        name: "cellSizeFactor",
        possibleValues: [
          {
            CELL_SIZE_FACTOR: 0.5,
          },
          {
            CELL_SIZE_FACTOR: 1,
          },
        ],
      },
    ]
  }

  computeG(solver: SingleIntraNodeRouteSolver) {
    return (
      solver.iterations / 10_000 // + solver.hyperParameters.SHUFFLE_SEED! * 0.05
    )
  }

  computeH(solver: SingleIntraNodeRouteSolver) {
    return 1 - (solver.progress || 0)
  }

  generateSolver(hyperParameters: any): SingleIntraNodeRouteSolver {
    return new SingleIntraNodeRouteSolver({
      ...this.constructorParams,
      hyperParameters,
    })
  }

  onSolve(solver: SupervisedSolver<SingleIntraNodeRouteSolver>) {
    this.solvedRoutes = solver.solver.solvedRoutes
  }
}
