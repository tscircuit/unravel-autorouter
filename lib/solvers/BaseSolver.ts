import type { GraphicsObject } from "graphics-debug"

export class BaseSolver {
  MAX_ITERATIONS = 1000
  solved = false
  failed = false
  iterations = 0
  progress = 0
  error: string | null = null
  activeSubSolver?: BaseSolver
  failedSubSolvers?: BaseSolver[]

  /** DO NOT OVERRIDE! Override _step() instead */
  step() {
    if (this.solved) return
    if (this.failed) return
    this.iterations++
    try {
      this._step()
    } catch (e) {
      this.error = `${this.constructor.name} error: ${e}`
      console.error(this.error)
      this.failed = true
      throw e
    }
    if (!this.solved && this.iterations > this.MAX_ITERATIONS) {
      this.error = `${this.constructor.name} did not converge`
      console.error(this.error)
      this.failed = true
    }
  }

  _step() {}

  solve() {
    while (!this.solved && !this.failed) {
      this.step()
    }
  }

  visualize(): GraphicsObject {
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
  }
}
