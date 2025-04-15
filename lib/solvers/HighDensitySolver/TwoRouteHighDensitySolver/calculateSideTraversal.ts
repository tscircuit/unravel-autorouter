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

// Keep a small epsilon for floating point comparisons
const EPSILON = 1e-9 // Using a slightly smaller epsilon can sometimes help precision

/**
 * Calculates the percentage of each side traversed when going from point A to point B
 * along the rectangle boundary.
 * Assumes traversal is always in the 'forward' direction along the perimeter (clockwise conceptually).
 */
function calculateSegmentTraversal(
  startPoint: Point,
  endPoint: Point,
  bounds: Bounds,
  turnDirection?: "cw" | "ccw",
): SidePercentages {
  const startAngle = pointToAngle(startPoint, bounds)
  let endAngle = pointToAngle(endPoint, bounds)

  // Handle angle wrap-around (e.g., traversing past the 2π point)
  // If the end angle is less than the start angle, it means we crossed the 0/2π boundary
  if (endAngle < startAngle) {
    endAngle += 2 * Math.PI
  }

  // Use the existing helper, which calculates percentages based on a start and end angle
  // Ensure the end angle is strictly greater for non-zero traversal
  if (Math.abs(endAngle - startAngle) < EPSILON) {
    return { left: 0, top: 0, right: 0, bottom: 0 } // No movement
  }

  return calculateSidePercentages(startAngle, endAngle, bounds, turnDirection)
}

/**
 * Calculates the total percentage of each side traversed when going sequentially
 * from A to B, and then from B to C along a rectangle boundary.
 */
export function calculateTraversalPercentages(
  A: Point,
  B: Point,
  C: Point,
  bounds: Bounds,
  turnDirection?: "cw" | "ccw",
): SidePercentages {
  // Calculate traversal percentages for the segment A -> B
  const percentagesAB = calculateSegmentTraversal(A, B, bounds, turnDirection)

  // Calculate traversal percentages for the segment B -> C
  const percentagesBC = calculateSegmentTraversal(B, C, bounds, turnDirection)

  // Sum the percentages from both segments
  // Use Math.min to cap at 1.0 in case of tiny floating point overflows
  const totalPercentages: SidePercentages = {
    left: Math.min(1.0, percentagesAB.left + percentagesBC.left),
    top: Math.min(1.0, percentagesAB.top + percentagesBC.top),
    right: Math.min(1.0, percentagesAB.right + percentagesBC.right),
    bottom: Math.min(1.0, percentagesAB.bottom + percentagesBC.bottom),
  }

  // Optional: Clean up near-zero values resulting from floating point inaccuracies
  for (const key in totalPercentages) {
    if (Math.abs(totalPercentages[key as keyof SidePercentages]) < EPSILON) {
      totalPercentages[key as keyof SidePercentages] = 0
    }
  }

  return totalPercentages
}

/**
 * Converts a point on the rectangle boundary to an angle (0 to 2π, clockwise from top-left).
 * Updated to be slightly more robust with epsilon checks.
 */
export function pointToAngle(point: Point, bounds: Bounds): number {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  // Avoid division by zero if width or height is zero
  if (width < EPSILON && height < EPSILON) return 0
  const perimeter = 2 * (width + height)
  if (perimeter < EPSILON) return 0 // Avoid division by zero for degenerate rectangles

  let distance = 0

  // Check sides using epsilon comparisons
  if (
    Math.abs(point.y - bounds.maxY) < EPSILON &&
    point.x >= bounds.minX - EPSILON &&
    point.x <= bounds.maxX + EPSILON
  ) {
    // Top side (y is maxY)
    // Ensure x is clamped within bounds for distance calculation robustness
    distance = Math.max(0, Math.min(width, point.x - bounds.minX))
  } else if (
    Math.abs(point.x - bounds.maxX) < EPSILON &&
    point.y >= bounds.minY - EPSILON &&
    point.y <= bounds.maxY + EPSILON
  ) {
    // Right side (x is maxX)
    // Ensure y is clamped within bounds
    distance = width + Math.max(0, Math.min(height, bounds.maxY - point.y))
  } else if (
    Math.abs(point.y - bounds.minY) < EPSILON &&
    point.x >= bounds.minX - EPSILON &&
    point.x <= bounds.maxX + EPSILON
  ) {
    // Bottom side (y is minY)
    // Ensure x is clamped within bounds
    distance =
      width + height + Math.max(0, Math.min(width, bounds.maxX - point.x))
  } else if (
    Math.abs(point.x - bounds.minX) < EPSILON &&
    point.y >= bounds.minY - EPSILON &&
    point.y <= bounds.maxY + EPSILON
  ) {
    // Left side (x is minX)
    // Ensure y is clamped within bounds
    distance =
      width +
      height +
      width +
      Math.max(0, Math.min(height, point.y - bounds.minY))
  } else {
    // Point might be slightly off boundary due to precision, try snapping it?
    // Or throw error as before. For now, let's log a warning and try snapping.
    // console.warn(
    //   "Point does not lie exactly on the boundary, attempting to snap.",
    //   { point, bounds },
    // )
    // Simple snap: Find closest side point (more complex logic could be added here)
    // For simplicity, we'll re-call with snapped points if needed, or just throw.
    // Let's stick to the original error for now if it's significantly off.
    throw new Error(
      `Point (${point.x}, ${point.y}) does not lie on the boundary defined by ${JSON.stringify(bounds)}`,
    )
    // Alternative: Add logic here to find the closest point on the boundary and use that.
  }

  // Ensure distance doesn't exceed perimeter due to float issues
  distance = Math.max(0, Math.min(perimeter, distance))

  // Convert distance to angle (0 to 2π)
  // Handle perimeter being zero
  return perimeter > EPSILON ? (distance / perimeter) * (2 * Math.PI) : 0
}

/**
 * Calculate percentages of each side traversed based on start and end angles (endAngle >= startAngle).
 * This function remains largely the same but benefits from corrected inputs.
 */
function calculateSidePercentages(
  startAngle: number,
  endAngle: number,
  bounds: Bounds,
  turnDirection?: "cw" | "ccw",
): SidePercentages {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  // Avoid division by zero if width or height is zero
  if (width < EPSILON && height < EPSILON)
    return { left: 0, top: 0, right: 0, bottom: 0 }
  const perimeter = 2 * (width + height)
  if (perimeter < EPSILON) return { left: 0, top: 0, right: 0, bottom: 0 }

  // Define angle ranges for each side (clockwise from top-left = 0)
  // Ensure denominator is non-zero
  const angleTopEnd = (width / perimeter) * (2 * Math.PI)
  const angleRightEnd = ((width + height) / perimeter) * (2 * Math.PI)
  const angleBottomEnd = ((width + width + height) / perimeter) * (2 * Math.PI)
  const angleLeftEnd = 2 * Math.PI // Full circle

  const sides = [
    { name: "top", start: 0, end: angleTopEnd, length: width },
    { name: "right", start: angleTopEnd, end: angleRightEnd, length: height },
    {
      name: "bottom",
      start: angleRightEnd,
      end: angleBottomEnd,
      length: width,
    },
    { name: "left", start: angleBottomEnd, end: angleLeftEnd, length: height }, // Ends at 2PI
  ]

  const result: SidePercentages = { left: 0, top: 0, right: 0, bottom: 0 }
  const totalAngleTraversal = endAngle - startAngle

  if (totalAngleTraversal < EPSILON) return result // No traversal

  for (const side of sides) {
    const sideAngleRange = side.end - side.start

    // Skip calculation if side length (and thus angle range) is effectively zero
    if (sideAngleRange < EPSILON || side.length < EPSILON) continue

    // Calculate overlap
    const overlapStart = Math.max(startAngle, side.start)
    const overlapEnd = Math.min(endAngle, side.end)

    if (overlapStart < overlapEnd - EPSILON) {
      // Check overlap is significant
      const traversedAngleOnSide = overlapEnd - overlapStart

      // Percentage calculation: (traversed angle on side) / (total angle range of side)
      // This gives the fraction *of the side* that was covered by this segment traversal.
      const percentage = traversedAngleOnSide / sideAngleRange

      // Add percentage, ensuring it's non-negative
      result[side.name as keyof SidePercentages] += Math.max(0, percentage)
    }
  }

  // Normalize results slightly in case of FP inaccuracies summing up
  for (const key in result) {
    result[key as keyof SidePercentages] = Math.max(
      0,
      Math.min(1.0, result[key as keyof SidePercentages]),
    )
  }

  return result
}
