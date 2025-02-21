import { SingleIntraNodeRouteSolver } from "../HighDensitySolver/SingleIntraNodeRouteSolver"
import { HyperParameterSupervisorSolver } from "../HyperParameterSupervisorSolver"

export class HyperSingleIntraNodeSolver extends HyperParameterSupervisorSolver<SingleIntraNodeRouteSolver> {
  constructorParams: ConstructorParameters<typeof SingleIntraNodeRouteSolver>[0]

  constructor(
    opts: ConstructorParameters<typeof SingleIntraNodeRouteSolver>[0],
  ) {
    super()
    this.constructorParams = opts
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
        ],
      },
    ]
  }

  generateSolver(hyperParameters: any): SingleIntraNodeRouteSolver {
    return new SingleIntraNodeRouteSolver({
      ...this.constructorParams,
      hyperParameters,
    })
  }
}
