import {
  HyperParameterSupervisorSolver,
  SupervisedSolver,
} from "../HyperParameterSupervisorSolver"
import {
  CapacityPathingSingleSectionPathingSolver,
  CapacityPathingSingleSectionPathingSolverParams,
} from "./CapacityPathingSingleSectionPathingSolver"
import { CapacityMeshNode } from "lib/types"

export class HyperCapacityPathingSingleSectionPathingSolver extends HyperParameterSupervisorSolver<CapacityPathingSingleSectionPathingSolver> {
  constructorParams: CapacityPathingSingleSectionPathingSolverParams
  bestSolvedPaths: Array<{
    connectionName: string
    path: CapacityMeshNode[]
  }> | null = null

  constructor(
    opts: CapacityPathingSingleSectionPathingSolverParams,
    supervisorOpts: {
      maxIterations?: number
      greedyMultiplier?: number
      minSubSteps?: number
    } = {},
  ) {
    super()
    this.constructorParams = opts
    this.MAX_ITERATIONS = supervisorOpts.maxIterations ?? 100_000 // Max total iterations for the supervisor
    this.GREEDY_MULTIPLIER = supervisorOpts.greedyMultiplier ?? 1 // How much to prioritize heuristic (lower progress)
    this.MIN_SUBSTEPS = supervisorOpts.minSubSteps ?? 100 // Minimum steps a sub-solver runs before re-evaluation
  }

  getCombinationDefs() {
    // Define the combinations of hyperparameter sets to try
    // Here, we only have one set, "orderings6"
    return [["orderings6"]]
  }

  getHyperParameterDefs() {
    // Define the available hyperparameters and their possible values
    return [
      {
        name: "orderings6",
        possibleValues: [
          { SHUFFLE_SEED: 0 },
          { SHUFFLE_SEED: 1 },
          { SHUFFLE_SEED: 2 },
          { SHUFFLE_SEED: 3 },
          { SHUFFLE_SEED: 4 },
          { SHUFFLE_SEED: 5 },
        ],
      },
      // Add other hyperparameter definitions here if needed, e.g., for EXPANSION_DEGREES
      // {
      //   name: "expansionDegrees",
      //   possibleValues: [
      //     { EXPANSION_DEGREES: 1 },
      //     { EXPANSION_DEGREES: 2 },
      //     { EXPANSION_DEGREES: 3 },
      //   ],
      // },
    ]
  }

  computeG(solver: CapacityPathingSingleSectionPathingSolver) {
    // Cost function (g): Lower is better.
    // Use iterations as a simple cost measure.
    // Normalize by a factor to keep values reasonable.
    return solver.iterations / 1000
  }

  computeH(solver: CapacityPathingSingleSectionPathingSolver) {
    // Heuristic function (h): Lower is better (estimates remaining cost).
    // Use progress (0 to 1, where 1 is solved). 1 - progress estimates remaining work.
    // If progress isn't available, estimate based on remaining connections.
    const progress =
      solver.currentConnectionIndex / solver.sectionConnectionTerminals.length
    return 1 - (progress || 0)
  }

  generateSolver(
    hyperParameters: any,
  ): CapacityPathingSingleSectionPathingSolver {
    // Create a new instance of the underlying solver with the given hyperparameters
    return new CapacityPathingSingleSectionPathingSolver({
      ...this.constructorParams,
      hyperParameters: {
        ...this.constructorParams.hyperParameters, // Keep existing HPs
        ...hyperParameters, // Add/overwrite with HPs for this run
      },
    })
  }

  onSolve(solver: SupervisedSolver<CapacityPathingSingleSectionPathingSolver>) {
    // This method is called when a supervised solver successfully completes.
    // Store the results from the successful solver.
    // Since this supervisor aims to find *a* solution, we can just take the first one.
    // If optimizing for the "best" solution, you'd compare results here.
    this.bestSolvedPaths = solver.solver.sectionConnectionTerminals
      .filter((t) => t.path)
      .map((t) => ({
        connectionName: t.connectionName,
        path: t.path!,
      }))
    // Mark the supervisor as solved since we found a solution.
    this.solved = true
  }

  // Optional: Override visualize if needed, otherwise it uses the active sub-solver's visualize
  // visualize(): GraphicsObject {
  //   // Custom visualization logic for the supervisor state, or delegate
  //   return super.visualize();
  // }
}
