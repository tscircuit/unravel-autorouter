import { HyperSingleIntraNodeSolver } from "../lib/solvers/HyperHighDensitySolver/HyperSingleIntraNodeSolver"

export default () => {
  const solver = new HyperSingleIntraNodeSolver()
  return (
    <pre>{JSON.stringify(solver.getHyperParameterCombinations(), null, 2)}</pre>
  )
}
