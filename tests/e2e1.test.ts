import { expect, test, describe } from "bun:test"
import { CapacityMeshSolver } from "../lib"
import keyboardRoutes from "../examples/assets/growing-grid-keyboard-sample-sample95-unrouted_simple_route.json"
import type {
  SimpleRouteJson,
  SimplifiedPcbTraces,
  Obstacle,
} from "../lib/types"

describe("Keyboard1 End-to-End Test", () => {
  test("should solve keyboard1 board and produce valid SimpleRouteJson output", async () => {
    // Create a solver with the keyboard1 input
    const solver = new CapacityMeshSolver(
      keyboardRoutes as unknown as SimpleRouteJson,
    )

    // Run the solver until completion or failure
    solver.solve()

    // Verify solver completed successfully
    expect(solver.failed).toBe(false)
    expect(solver.solved).toBe(true)

    // Get output SimpleRouteJson
    const output = solver.getOutputSimpleRouteJson()

    // Verify the output structure and contents
    expect(output).toBeDefined()
    expect(output.layerCount).toEqual(keyboardRoutes.layerCount)
    expect(output.minTraceWidth).toEqual(keyboardRoutes.minTraceWidth)
    // Type assertion to handle the type inconsistency
    expect(output.obstacles).toEqual(keyboardRoutes.obstacles as Obstacle[])
    expect(output.bounds).toEqual(keyboardRoutes.bounds)

    // Verify traces were generated
    expect(output.traces).toBeDefined()
    expect(Array.isArray(output.traces)).toBe(true)
    expect(output.traces!.length).toBeGreaterThan(0)

    // Verify trace structure
    const traces = output.traces as SimplifiedPcbTraces
    for (const trace of traces) {
      expect(trace.type).toBe("pcb_trace")
      expect(typeof trace.pcb_trace_id).toBe("string")
      expect(Array.isArray(trace.route)).toBe(true)
      expect(trace.route.length).toBeGreaterThan(0)

      // Verify each route point has required properties
      for (const point of trace.route) {
        if (point.route_type === "wire") {
          expect(typeof point.x).toBe("number")
          expect(typeof point.y).toBe("number")
          expect(typeof point.width).toBe("number")
          expect(typeof point.layer).toBe("string")
        } else if (point.route_type === "via") {
          expect(typeof point.x).toBe("number")
          expect(typeof point.y).toBe("number")
          expect(typeof point.from_layer).toBe("string")
          expect(typeof point.to_layer).toBe("string")
        } else {
          throw new Error(`Unknown route_type: ${(point as any).route_type}`)
        }
      }
    }

    // Verify line simplification by checking that adjacent points aren't collinear
    // (this test may need adjustment based on actual implementation details)
    for (const trace of traces) {
      const wirePoints = trace.route.filter((p) => p.route_type === "wire")

      for (let i = 1; i < wirePoints.length - 1; i++) {
        const prev = wirePoints[i - 1]
        const curr = wirePoints[i]
        const next = wirePoints[i + 1]

        if (prev.layer === curr.layer && curr.layer === next.layer) {
          // Skip non-wire points
          if (
            prev.route_type !== "wire" ||
            curr.route_type !== "wire" ||
            next.route_type !== "wire"
          ) {
            continue
          }

          // Check if three consecutive points are collinear
          const dx1 = curr.x - prev.x
          const dy1 = curr.y - prev.y
          const dx2 = next.x - curr.x
          const dy2 = next.y - curr.y

          // For collinear points, cross product should be close to zero
          const crossProduct = Math.abs(dx1 * dy2 - dy1 * dx2)

          // If points are collinear, the middle point should have been removed
          // during simplification, so we expect the cross product to be non-zero
          if (crossProduct < 0.001) {
            // Only fail the test if the points are nearly identical
            const dotProduct = dx1 * dx2 + dy1 * dy2
            if (dotProduct > 0) {
              throw new Error(`Found collinear points that should have been simplified:
                prev: (${prev.x}, ${prev.y})
                curr: (${curr.x}, ${curr.y})
                next: (${next.x}, ${next.y})
                crossProduct: ${crossProduct}
              `)
            }
          }
        }
      }
    }
  }, 60000) // Allow up to 60 seconds for this test
})
