interface Point {
  x: number
  y: number
}

/**
 * Calculates the minimum distance between two line segments.
 * @param A1 First point of the first line segment
 * @param A2 Second point of the first line segment
 * @param B1 First point of the second line segment
 * @param B2 Second point of the second line segment
 * @returns The minimum distance between the two line segments
 */
export function minimumDistanceBetweenSegments(
  A1: Point,
  A2: Point,
  B1: Point,
  B2: Point,
): number {
  // Check if segments intersect
  if (segmentsIntersect(A1, A2, B1, B2)) {
    return 0
  }

  // Calculate distances from each endpoint to the other segment
  const distA1 = pointToSegmentDistance(A1, B1, B2)
  const distA2 = pointToSegmentDistance(A2, B1, B2)
  const distB1 = pointToSegmentDistance(B1, A1, A2)
  const distB2 = pointToSegmentDistance(B2, A1, A2)

  // Return the minimum of the four distances
  return Math.min(distA1, distA2, distB1, distB2)
}

/**
 * Calculates the distance from a point to a line segment.
 * @param P The point
 * @param Q1 First point of the line segment
 * @param Q2 Second point of the line segment
 * @returns The minimum distance from point P to the line segment Q1Q2
 */
function pointToSegmentDistance(P: Point, Q1: Point, Q2: Point): number {
  const v = { x: Q2.x - Q1.x, y: Q2.y - Q1.y }
  const w = { x: P.x - Q1.x, y: P.y - Q1.y }

  // Calculate squared length of the segment
  const c1 = dotProduct(w, v)
  if (c1 <= 0) {
    // Point is behind Q1
    return distance(P, Q1)
  }

  const c2 = dotProduct(v, v)
  if (c2 <= c1) {
    // Point is beyond Q2
    return distance(P, Q2)
  }

  // Point projects onto the segment
  const b = c1 / c2
  const Pb = {
    x: Q1.x + b * v.x,
    y: Q1.y + b * v.y,
  }
  return distance(P, Pb)
}

/**
 * Calculates the dot product of two vectors.
 */
function dotProduct(
  v1: { x: number; y: number },
  v2: { x: number; y: number },
): number {
  return v1.x * v2.x + v1.y * v2.y
}

/**
 * Calculates the Euclidean distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Determines the orientation of triplet (p, q, r).
 * @returns 0 if collinear, 1 if clockwise, 2 if counterclockwise
 */
function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (val === 0) return 0 // collinear
  return val > 0 ? 1 : 2 // clockwise or counterclockwise
}

/**
 * Checks if point q lies on segment pr.
 */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  )
}

/**
 * Checks if two line segments intersect.
 */
function segmentsIntersect(
  A1: Point,
  A2: Point,
  B1: Point,
  B2: Point,
): boolean {
  // Find the four orientations needed for general case
  const o1 = orientation(A1, A2, B1)
  const o2 = orientation(A1, A2, B2)
  const o3 = orientation(B1, B2, A1)
  const o4 = orientation(B1, B2, A2)

  // General case
  if (o1 !== o2 && o3 !== o4) return true

  // Special Cases
  // A1, A2 and B1 are collinear and B1 lies on segment A1A2
  if (o1 === 0 && onSegment(A1, B1, A2)) return true

  // A1, A2 and B2 are collinear and B2 lies on segment A1A2
  if (o2 === 0 && onSegment(A1, B2, A2)) return true

  // B1, B2 and A1 are collinear and A1 lies on segment B1B2
  if (o3 === 0 && onSegment(B1, A1, B2)) return true

  // B1, B2 and A2 are collinear and A2 lies on segment B1B2
  if (o4 === 0 && onSegment(B1, A2, B2)) return true

  return false // Doesn't fall in any of the above cases
}
