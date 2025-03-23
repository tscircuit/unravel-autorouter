interface Point {
  x: number
  y: number
}

interface Circle {
  center: Point
  radius: number
}

/**
 * Finds the tangent points and their intersection for the shortest path from C to A
 * that touches the circle Q at points B and D.
 *
 * @param A First observation point
 * @param C Second observation point
 * @param Q Circle definition with center and radius
 * @returns Object containing points B, D, and E
 */
export function findPointToGetAroundCircle(
  A: Point,
  C: Point,
  Q: Circle,
): { B: Point; D: Point; E: Point } {
  // Compute point B (tangent from C to circle Q)
  const B = computeTangentPoint(C, A, Q.center, Q.radius)

  // Compute point D (tangent from A to circle Q)
  const D = computeTangentPoint(A, C, Q.center, Q.radius)

  // Compute point E (intersection of CB and AD)
  const E = computeIntersection(
    { x: C.x, y: C.y },
    { x: B.x, y: B.y },
    { x: A.x, y: A.y },
    { x: D.x, y: D.y },
  )

  return { B, D, E }
}

/**
 * Computes the tangent point from an observation point to a circle
 *
 * @param observationPoint The point from which the tangent is drawn
 * @param referencePoint A reference point that helps determine which side of the circle to choose
 * @param circleCenter The center of the circle
 * @param radius The radius of the circle
 * @returns The tangent point on the circle
 */
function computeTangentPoint(
  observationPoint: Point,
  referencePoint: Point,
  circleCenter: Point,
  radius: number,
): Point {
  // Vector from observation point to circle center
  const CQ = [
    circleCenter.x - observationPoint.x,
    circleCenter.y - observationPoint.y,
  ]
  const CQLength = Math.sqrt(CQ[0] * CQ[0] + CQ[1] * CQ[1])

  // Check if tangent is possible
  if (CQLength < radius) {
    console.error("Circle is too close to observation point to have a tangent")
    return observationPoint // Return observation point if no tangent is possible
  }

  // Vector from observation point to reference point (to determine which side of the circle)
  const CR = [
    referencePoint.x - observationPoint.x,
    referencePoint.y - observationPoint.y,
  ]

  // Calculate the distance from observation point to the tangent point
  const d = Math.sqrt(CQLength * CQLength - radius * radius)

  // Normalize CQ to get the unit vector in that direction
  const CQUnit = [CQ[0] / CQLength, CQ[1] / CQLength]

  // Calculate two possible perpendicular unit vectors
  const perp1 = [-CQUnit[1], CQUnit[0]]
  const perp2 = [CQUnit[1], -CQUnit[0]]

  // Choose the perpendicular that forms an angle closer to CR
  const dot1 = CR[0] * perp1[0] + CR[1] * perp1[1]
  const dot2 = CR[0] * perp2[0] + CR[1] * perp2[1]
  const perp = dot1 > dot2 ? perp1 : perp2

  // Calculate the sine and cosine of the angle from CQ to the tangent line
  const sinTheta = radius / CQLength
  const cosTheta = d / CQLength

  // Unit vector in the direction of the tangent point
  const unitToTangent = [
    CQUnit[0] * cosTheta + perp[0] * sinTheta,
    CQUnit[1] * cosTheta + perp[1] * sinTheta,
  ]

  // Calculate the tangent point
  return {
    x: observationPoint.x + d * unitToTangent[0],
    y: observationPoint.y + d * unitToTangent[1],
  }
}

/**
 * Computes the intersection point of two lines defined by points (p1,p2) and (p3,p4)
 *
 * @param p1 First point on first line
 * @param p2 Second point on first line
 * @param p3 First point on second line
 * @param p4 Second point on second line
 * @returns The intersection point
 */
function computeIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): Point {
  // Line 1 represented as a1x + b1y = c1
  const a1 = p2.y - p1.y
  const b1 = p1.x - p2.x
  const c1 = a1 * p1.x + b1 * p1.y

  // Line 2 represented as a2x + b2y = c2
  const a2 = p4.y - p3.y
  const b2 = p3.x - p4.x
  const c2 = a2 * p3.x + b2 * p3.y

  // Determinant
  const det = a1 * b2 - a2 * b1

  if (Math.abs(det) < 1e-8) {
    // Lines are parallel, return midpoint between p1 and p3 as fallback
    return {
      x: (p1.x + p3.x) / 2,
      y: (p1.y + p3.y) / 2,
    }
  }

  // Calculate intersection point
  const x = (b2 * c1 - b1 * c2) / det
  const y = (a1 * c2 - a2 * c1) / det

  return { x, y }
}
