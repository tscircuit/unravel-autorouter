import type { GraphicsObject } from "graphics-debug"

export class BaseSolver {
  MAX_ITERATIONS = 1000
  solved = false
  failed = false
  iterations = 0
  progress = 0
  error: string | null = null

  step() {}

  solve() {
    let iters = 0
    while (!this.solved && !this.failed) {
      iters++
      this.iterations = iters
      try {
        this.step()
      } catch (e) {
        this.error = `${this.constructor.name} error: ${e}`
        console.error(this.error)
        this.failed = true
        break
      }

      if (this.iterations > this.MAX_ITERATIONS) {
        this.error = `${this.constructor.name} did not converge`
        console.error(this.error)
        this.failed = true
        break
      }
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
