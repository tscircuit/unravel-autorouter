// EPS is used for floating point comparisons
const EPS = 1e-9

export function almostEqual(a, b, eps = EPS) {
  return Math.abs(a - b) < eps
}

export function pointKey(p, eps = EPS) {
  // Hashable key for deduplication
  return `${Math.round(p.x / eps)}:${Math.round(p.y / eps)}`
}

export function cross(ax, ay, bx, by) {
  return ax * by - ay * bx
}

export function segmentIntersection(p, p2, q, q2) {
  // Returns intersection point of segments pp2 and qq2 or null if none
  const r = { x: p2.x - p.x, y: p2.y - p.y }
  const s = { x: q2.x - q.x, y: q2.y - q.y }
  const denom = cross(r.x, r.y, s.x, s.y)
  if (almostEqual(denom, 0)) return null // Parallel or collinear
  const qp = { x: q.x - p.x, y: q.y - p.y }
  const t = cross(qp.x, qp.y, s.x, s.y) / denom
  const u = cross(qp.x, qp.y, r.x, r.y) / denom
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null // Outside
  return { x: p.x + t * r.x, y: p.y + t * r.y }
}

export function polygonArea(points) {
  let a = 0
  for (let i = 0, n = points.length; i < n; ++i) {
    const j = (i + 1) % n
    a += points[i].x * points[j].y - points[j].x * points[i].y
  }
  return 0.5 * a
}

export function polygonCentroid(points) {
  let a = 0,
    cx = 0,
    cy = 0
  for (let i = 0, n = points.length; i < n; ++i) {
    const j = (i + 1) % n
    const cross = points[i].x * points[j].y - points[j].x * points[i].y
    a += cross
    cx += (points[i].x + points[j].x) * cross
    cy += (points[i].y + points[j].y) * cross
  }
  a *= 0.5
  if (almostEqual(a, 0)) return null
  cx /= 6 * a
  cy /= 6 * a
  return { x: cx, y: cy }
}

// DCEL structures
export class Vertex {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.out = [] // Outgoing half-edges
  }
}

export class HalfEdge {
  constructor(orig, dest) {
    this.orig = orig // Vertex index
    this.dest = dest // Vertex index
    this.twin = null // Half-edge index
    this.next = null // Half-edge index (around left face)
    this.visited = false
  }
}

export function computeRegionCentroids(rectangle, userSegments) {
  // 1. Build full segment list (user + rectangle perimeter)
  const rectEdges = [
    {
      a: { x: rectangle.minX, y: rectangle.minY },
      b: { x: rectangle.maxX, y: rectangle.minY },
    },
    {
      a: { x: rectangle.maxX, y: rectangle.minY },
      b: { x: rectangle.maxX, y: rectangle.maxY },
    },
    {
      a: { x: rectangle.maxX, y: rectangle.maxY },
      b: { x: rectangle.minX, y: rectangle.maxY },
    },
    {
      a: { x: rectangle.minX, y: rectangle.maxY },
      b: { x: rectangle.minX, y: rectangle.minY },
    },
  ]
  const segments = [...userSegments, ...rectEdges]

  // 2. Collect breakpoints on each segment (endpoints + intersections)
  const breakMap = segments.map(() => []) // Array of arrays of points per segment

  // Add endpoints
  for (let i = 0; i < segments.length; ++i) {
    const s = segments[i]
    breakMap[i].push(s.a, s.b)
  }

  // Intersections between segments
  for (let i = 0; i < segments.length; ++i) {
    for (let j = i + 1; j < segments.length; ++j) {
      const p = segmentIntersection(
        segments[i].a,
        segments[i].b,
        segments[j].a,
        segments[j].b,
      )
      if (p) {
        breakMap[i].push(p)
        breakMap[j].push(p)
      }
    }
  }

  // 3. Deduplicate global vertices, assign ids
  const vertexId = new Map()
  const vertices = []

  function getVertexId(p) {
    const key = pointKey(p)
    if (!vertexId.has(key)) {
      const id = vertices.length
      vertexId.set(key, id)
      vertices.push(new Vertex(p.x, p.y))
      return id
    }
    return vertexId.get(key)
  }

  // Sort breakpoint lists along each segment and create sub-edges
  const undirectedEdges = []
  for (let i = 0; i < segments.length; ++i) {
    const s = segments[i]
    const list = breakMap[i].slice()
    // Parametric position t along segment
    list.sort((p1, p2) => {
      const dx = s.b.x - s.a.x
      const dy = s.b.y - s.a.y
      const t1 = almostEqual(Math.abs(dx), 0)
        ? (p1.y - s.a.y) / dy
        : (p1.x - s.a.x) / dx
      const t2 = almostEqual(Math.abs(dx), 0)
        ? (p2.y - s.a.y) / dy
        : (p2.x - s.a.x) / dx
      return t1 - t2
    })
    for (let k = 0; k < list.length - 1; ++k) {
      const v1 = getVertexId(list[k])
      const v2 = getVertexId(list[k + 1])
      if (v1 !== v2) undirectedEdges.push([v1, v2])
    }
  }

  // 4. Build half-edges
  const halfEdges = []
  for (const [v1, v2] of undirectedEdges) {
    const he1 = new HalfEdge(v1, v2)
    const he2 = new HalfEdge(v2, v1)
    he1.twin = halfEdges.length + 1
    he2.twin = halfEdges.length
    const id1 = halfEdges.length
    halfEdges.push(he1, he2)
    // Push to vertex outgoing
    vertices[v1].out.push(id1)
    vertices[v2].out.push(id1 + 1)
  }

  // 5. Sort outgoing edges CCW around each vertex & set next pointers
  for (let vid = 0; vid < vertices.length; ++vid) {
    const v = vertices[vid]
    v.out.sort((e1, e2) => {
      const d1 = vertices[halfEdges[e1].dest]
      const d2 = vertices[halfEdges[e2].dest]
      const a1 = Math.atan2(d1.y - v.y, d1.x - v.x)
      const a2 = Math.atan2(d2.y - v.y, d2.x - v.x)
      return a1 - a2
    })
    const m = v.out.length
    for (let i = 0; i < m; ++i) {
      const heOut = v.out[i]
      const hePrev = v.out[(i - 1 + m) % m] // CW predecessor
      halfEdges[halfEdges[heOut].twin].next = hePrev // twin.next = CW-prev to keep left face on our left
    }
  }

  // 6. Walk faces and compute centroids
  const centroids = []
  const faces = []

  for (let h = 0; h < halfEdges.length; ++h) {
    if (halfEdges[h].visited) continue
    let walk = h
    const poly = []
    const faceEdges = []

    do {
      halfEdges[walk].visited = true
      poly.push(vertices[halfEdges[walk].orig])
      faceEdges.push(walk)
      walk = halfEdges[walk].next
    } while (walk !== null && walk !== h && !halfEdges[walk].visited)

    if (poly.length < 3) continue

    const area = polygonArea(poly)
    if (area > EPS) {
      const c = polygonCentroid(poly)
      if (c) {
        centroids.push(c)
        faces.push({
          vertices: poly.map((p) => ({ x: p.x, y: p.y })),
          centroid: c,
        })
      }
    }
  }

  return { centroids, faces, allVertices: vertices }
}
