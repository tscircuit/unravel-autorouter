import { BaseSolver } from "./BaseSolver"

export type HyperParameterDef = {
  name: string
  possibleValues: Array<any>
}

/**
 * The HyperParameterSupervisorSolver is a solver that solves a problem by
 * running competing solvers with different hyperparameters.
 *
 * As solvers make progress, the supervisor will allow the best solvers to run
 * for more iterations, prioritizing the solvers that are working the best.
 */
export class HyperParameterSupervisorSolver<
  T extends BaseSolver,
> extends BaseSolver {
  GREEDY_MULTIPLIER = 1

  solvers?: Array<{
    hyperParameters: any

    solver: T
    iterations: number

    h: number
    g: number
    f: number
  }>

  constructor() {
    super()
    this.solvers = []
  }

  getHyperParameterDefs(): Array<HyperParameterDef> {
    throw new Error("Not implemented")
  }

  getHyperParameterCombinations(
    hyperParameterDefs?: Array<HyperParameterDef>,
  ): Array<Record<string, any>> {
    if (!hyperParameterDefs) {
      hyperParameterDefs = this.getHyperParameterDefs()
    }
    const combinations: Array<Record<string, any>> = []
    // Base case - no more hyperparameters to combine
    if (hyperParameterDefs.length === 0) {
      return [{}]
    }

    // Take first hyperparameter definition
    const [currentDef, ...remainingDefs] = hyperParameterDefs

    // Get combinations for remaining hyperparameters
    const subCombinations = this.getHyperParameterCombinations(remainingDefs)

    // For each possible value of current hyperparameter,
    // combine with all sub-combinations
    currentDef.possibleValues.forEach((value) => {
      subCombinations.forEach((subCombo) => {
        combinations.push({
          ...subCombo,
          [currentDef.name]: value,
        })
      })
    })

    return combinations
  }

  initializeSolvers() {
    const hyperParameterDefs = this.getHyperParameterDefs()
    const hyperParameterCombinations =
      this.getHyperParameterCombinations(hyperParameterDefs)

    this.solvers = []
    for (const hyperParameters of hyperParameterCombinations) {
      const solver = this.generateSolver(hyperParameters)
      this.solvers.push({
        hyperParameters,
        solver,
        iterations: 0,
        h: 0,
        g: 0,
        f: 0,
      })
    }
  }

  generateSolver(hyperParameters: any): T {
    throw new Error("Not implemented")
  }

  computeG(solver: T) {
    return solver.iterations
  }

  computeH(solver: T) {
    return (1 - solver.progress) * solver.MAX_ITERATIONS
  }

  computeF(g: number, h: number) {
    return g + h * this.GREEDY_MULTIPLIER
  }

  step() {
    //
  }
}
