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
    this.constructorParams = params
  }

  computeG(solver: CapacityPathingSingleSectionPathingSolver): number {
    return solver.iterations
  }

  computeH(solver: CapacityPathingSingleSectionPathingSolver): number {
    return solver.computeProgress() * 1000
  }

  getHyperParameterCombinations(
    hyperParameterDefs?: Array<HyperParameterDef>,
  ): Array<Record<string, any>> {}

  getHyperParameterDefs(): Array<HyperParameterDef> {}

  generateSolver(
    hyperParameters: any,
  ): CapacityPathingSingleSectionPathingSolver {}

  onSolve({
    solver,
  }: SupervisedSolver<CapacityPathingSingleSectionPathingSolver>) {
    this.winningSolver = solver
  }
}
