import type { GraphicsObject } from "graphics-debug"

export class BaseSolver {
  MAX_ITERATIONS = 1000
  solved = false
  iterations = 0

  step() {}

  solve() {
    while (!this.solved) {
      this.iterations++
      this.step()

      if (this.iterations > this.MAX_ITERATIONS) {
        throw new Error(`${this.constructor.name} did not converge`)
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
