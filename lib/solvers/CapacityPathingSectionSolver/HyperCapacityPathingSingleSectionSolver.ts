import { BaseSolver } from "../BaseSolver"
import {
  HyperParameterDef,
  HyperParameterSupervisorSolver,
  SupervisedSolver,
} from "../HyperParameterSupervisorSolver"
import {
  CapacityPathingSingleSectionPathingSolver,
  CapacityPathingSingleSectionPathingSolverParams,
} from "./CapacityPathingSingleSectionPathingSolver"

export class HyperCapacityPathingSingleSectionSolver extends HyperParameterSupervisorSolver<CapacityPathingSingleSectionPathingSolver> {
  constructorParams: CapacityPathingSingleSectionPathingSolverParams
  winningSolver?: CapacityPathingSingleSectionPathingSolver

  constructor(
    params: ConstructorParameters<
      typeof CapacityPathingSingleSectionPathingSolver
    >[0],
  ) {
    super()
    this.MAX_ITERATIONS = 10e3
    this.constructorParams = params
  }

  computeG(solver: CapacityPathingSingleSectionPathingSolver): number {
    return solver.iterations / 100
  }

  computeH(solver: CapacityPathingSingleSectionPathingSolver): number {
    return solver.computeProgress()
  }

  getCombinationDefs(): Array<Array<string>> | null {
    // TODO change combination defs based on hyperParameters.EXPANSION_DEGREES
    return [["orderings10"]]
  }

  getFailureMessage() {
    return `All CapacityPathingSingleSection solvers failed for "${this.centerNodeId}"`
  }

  getHyperParameterDefs(): Array<HyperParameterDef> {
    return [
      {
        name: "orderings10",
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
          {
            SHUFFLE_SEED: 8,
          },
          {
            SHUFFLE_SEED: 9,
          },
        ],
      },
    ]
  }

  generateSolver(
    hyperParameters: any,
  ): CapacityPathingSingleSectionPathingSolver {
    return new CapacityPathingSingleSectionPathingSolver({
      ...this.constructorParams,
      hyperParameters: {
        ...this.constructorParams.hyperParameters,
        ...hyperParameters,
      },
    })
  }

  onSolve({
    solver,
  }: SupervisedSolver<CapacityPathingSingleSectionPathingSolver>) {
    this.winningSolver = solver
  }

  get centerNodeId() {
    return this.constructorParams.centerNodeId
  }

  get sectionNodes() {
    return this.constructorParams.sectionNodes
  }

  get sectionConnectionTerminals() {
    return this.winningSolver?.sectionConnectionTerminals
  }
}
