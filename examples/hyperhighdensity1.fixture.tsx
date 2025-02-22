import { HyperSingleIntraNodeSolver } from "../lib/solvers/HyperHighDensitySolver/HyperSingleIntraNodeSolver"

export default () => {
  const solver = new HyperSingleIntraNodeSolver()
  return (
    <div>
      <p>
        These are all the hyperparameter combinations that would be run if we
        ran the supervisor solver.
      </p>
      <pre>
        {JSON.stringify(solver.getHyperParameterCombinations(), null, 2)}
      </pre>
    </div>
  )
}
