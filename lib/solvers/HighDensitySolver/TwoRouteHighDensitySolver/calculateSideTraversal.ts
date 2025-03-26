interface Point {
  x: number
  y: number
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface SidePercentages {
  left: number
  top: number
  right: number
  bottom: number
}

const EPSILON = 0.001

/**
 * Calculates the percentage of each side traversed when going from A to B to C along a rectangle boundary
 */
export function calculateTraversalPercentages(
  A: Point,
  B: Point,
  C: Point,
  bounds: Bounds,
): SidePercentages {
  // Step 1: Convert points to angles on a circle
  const angleA = pointToAngle(A, bounds)
  const angleB = pointToAngle(B, bounds)
  const angleC = pointToAngle(C, bounds)

  // Step 2: Determine the direction of traversal using point B
  const clockwiseAB = (angleB - angleA + 2 * Math.PI) % (2 * Math.PI)
  const clockwiseAC = (angleC - angleA + 2 * Math.PI) % (2 * Math.PI)
  const clockwise = clockwiseAB < clockwiseAC

  // Step 3: Calculate traversal angles based on direction
  const startAngle = clockwise ? angleA : angleC
  let endAngle = clockwise ? angleC : angleA

  // Ensure endAngle >= startAngle
  if (endAngle < startAngle) {
    endAngle += 2 * Math.PI
  }

  // Step 4: Calculate percentages for each side
  return calculateSidePercentages(startAngle, endAngle, bounds)
}

/**
 * Converts a point on the rectangle boundary to an angle (0 to 2π)
 */
function pointToAngle(point: Point, bounds: Bounds): number {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const perimeter = 2 * (width + height)

  // Calculate distance along the perimeter (clockwise from top-left corner)
  let distance = 0

  if (Math.abs(point.y - bounds.maxY) < EPSILON) {
    // Top side
    distance = point.x - bounds.minX
  } else if (Math.abs(point.x - bounds.maxX) < EPSILON) {
    // Right side
    distance = width + (bounds.maxY - point.y)
  } else if (Math.abs(point.y - bounds.minY) < EPSILON) {
    // Bottom side
    distance = width + height + (bounds.maxX - point.x)
  } else if (Math.abs(point.x - bounds.minX) < EPSILON) {
    // Left side
    distance = 2 * width + height + (point.y - bounds.minY)
  } else {
    throw new Error("Point does not lie on the boundary")
  }

  // Convert distance to angle (0 to 2π)
  return (distance / perimeter) * (2 * Math.PI)
}

/**
 * Calculate percentages of each side traversed based on start and end angles
 */
function calculateSidePercentages(
  startAngle: number,
  endAngle: number,
  bounds: Bounds,
): SidePercentages {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY

  // Define angle ranges for each side of the rectangle
  const sides = [
    {
      name: "top",
      start: 0,
      end: (width / (2 * (width + height))) * (2 * Math.PI),
    },
    {
      name: "right",
      start: (width / (2 * (width + height))) * (2 * Math.PI),
      end: ((width + height) / (2 * (width + height))) * (2 * Math.PI),
    },
    {
      name: "bottom",
      start: ((width + height) / (2 * (width + height))) * (2 * Math.PI),
      end: ((2 * width + height) / (2 * (width + height))) * (2 * Math.PI),
    },
    {
      name: "left",
      start: ((2 * width + height) / (2 * (width + height))) * (2 * Math.PI),
      end: 2 * Math.PI,
    },
  ]

  // Initialize result
  const result: SidePercentages = { left: 0, top: 0, right: 0, bottom: 0 }

  // Calculate traversal for each side
  for (const side of sides) {
    // Check if the traversal intersects with this side
    const overlapStart = Math.max(startAngle, side.start)
    const overlapEnd = Math.min(endAngle, side.end)

    if (overlapStart < overlapEnd) {
      // Calculate the percentage of this side that is traversed
      const sideAngleRange = side.end - side.start
      const traversedAngleRange = overlapEnd - overlapStart
      const percentage = traversedAngleRange / sideAngleRange

      result[side.name as keyof SidePercentages] = percentage
    }
  }

  return result
}
