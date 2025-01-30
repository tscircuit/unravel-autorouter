export class BaseSolver {
  MAX_ITERATIONS = 1000
  solved = false

  step() {}

  solve() {
    let iters = 0
    while (!this.solved) {
      iters++
      this.step()

      if (iters > this.MAX_ITERATIONS) {
        throw new Error("Solver did not converge")
      }
    }
  }
}
