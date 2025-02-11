import type { GraphicsObject } from "graphics-debug"

export class BaseSolver {
  MAX_ITERATIONS = 1000
  solved = false
  iterations = 0
  error: string | null = null

  step() {}

  solve() {
    while (!this.solved) {
      this.iterations++
      try {
        this.step()
      } catch (e) {
        this.error = `${this.constructor.name} error: ${e}`
        console.error(this.error)
        break
      }

      if (this.iterations > this.MAX_ITERATIONS) {
        this.error = `${this.constructor.name} did not converge`
        console.error(this.error)
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
