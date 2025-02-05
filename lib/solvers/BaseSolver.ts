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
        console.error(`${this.constructor.name} did not converge`)
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
