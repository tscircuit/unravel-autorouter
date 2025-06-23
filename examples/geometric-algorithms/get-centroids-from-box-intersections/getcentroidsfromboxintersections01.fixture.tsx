// @ts-nocheck
import { useState, useEffect, useRef } from "react"
import {
  getCentroidsFromInnerBoxIntersections,
  type Segment,
} from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/getCentroidsFromInnerBoxIntersections"
import { Bounds } from "@tscircuit/math-utils"

function generateRandomSegments(rect: Bounds, count: number): Segment[] {
  const segments = []
  const sides = [
    {
      start: { x: rect.minX, y: rect.minY },
      end: { x: rect.maxX, y: rect.minY },
      name: "bottom",
    },
    {
      start: { x: rect.maxX, y: rect.minY },
      end: { x: rect.maxX, y: rect.maxY },
      name: "right",
    },
    {
      start: { x: rect.maxX, y: rect.maxY },
      end: { x: rect.minX, y: rect.maxY },
      name: "top",
    },
    {
      start: { x: rect.minX, y: rect.maxY },
      end: { x: rect.minX, y: rect.minY },
      name: "left",
    },
  ]

  for (let i = 0; i < count; i++) {
    // Pick two different sides randomly
    const side1Index = Math.floor(Math.random() * 4)
    let side2Index
    do {
      side2Index = Math.floor(Math.random() * 4)
    } while (side1Index === side2Index)

    const side1 = sides[side1Index]
    const side2 = sides[side2Index]

    // Generate random points on the sides
    const t1 = Math.random()
    const t2 = Math.random()

    const point1 = {
      x: side1.start.x + t1 * (side1.end.x - side1.start.x),
      y: side1.start.y + t1 * (side1.end.y - side1.start.y),
    }

    const point2 = {
      x: side2.start.x + t2 * (side2.end.x - side2.start.x),
      y: side2.start.y + t2 * (side2.end.y - side2.start.y),
    }

    segments.push({ start: point1, end: point2 })
  }

  return segments
}

function BoxVisualization() {
  const [numLines, setNumLines] = useState(5)
  const [segments, setSegments] = useState([] as Segment[])
  const [result, setResult] = useState(null)
  const [boxSize, setBoxSize] = useState({ width: 500, height: 500 })
  const [rect, setRect] = useState({ minX: 50, minY: 50, maxX: 450, maxY: 450 })
  const canvasRef = useRef(null)

  // Generate new random segments when numLines changes
  useEffect(() => {
    const newSegments = generateRandomSegments(rect, numLines)
    setSegments(newSegments)
  }, [numLines, rect])

  // Compute centroids when segments change
  useEffect(() => {
    if (segments.length > 0) {
      const res = getCentroidsFromInnerBoxIntersections(rect, segments)
      setResult(res)
    }
  }, [segments, rect])

  // Draw everything when result changes
  useEffect(() => {
    if (!canvasRef.current || !result) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw the rectangle
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.strokeRect(
      rect.minX,
      rect.minY,
      rect.maxX - rect.minX,
      rect.maxY - rect.minY,
    )

    // Draw segments
    ctx.strokeStyle = "#0066cc"
    ctx.lineWidth = 1.5
    segments.forEach((segment) => {
      ctx.beginPath()
      ctx.moveTo(segment.start.x, segment.start.y)
      ctx.lineTo(segment.end.x, segment.end.y)
      ctx.stroke()
    })

    // Draw faces with semi-transparent colors
    if (result.faces) {
      result.faces.forEach((face, i) => {
        const hue = (i * 137.5) % 360 // Golden angle to distribute colors
        ctx.fillStyle = `hsla(${hue}, 70%, 70%, 0.3)`
        ctx.beginPath()
        ctx.moveTo(face.vertices[0].x, face.vertices[0].y)
        for (let j = 1; j < face.vertices.length; j++) {
          ctx.lineTo(face.vertices[j].x, face.vertices[j].y)
        }
        ctx.closePath()
        ctx.fill()
      })
    }

    // Draw centroids
    if (result.centroids) {
      ctx.fillStyle = "#ff0000"
      result.centroids.forEach((centroid) => {
        ctx.beginPath()
        ctx.arc(centroid.x, centroid.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Draw vertices
    if (result.allVertices) {
      ctx.fillStyle = "#333333"
      result.allVertices.forEach((vertex) => {
        ctx.beginPath()
        ctx.arc(vertex.x, vertex.y, 2, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }, [result, segments, rect])

  const regenerateLines = () => {
    const newSegments = generateRandomSegments(rect, numLines)
    setSegments(newSegments)
  }

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">
        Box Intersections Algorithm Visualization
      </h1>

      <div className="mb-4 flex items-center space-x-4">
        <div>
          <label htmlFor="numLines" className="mr-2 font-medium">
            Number of Lines:
          </label>
          <input
            id="numLines"
            type="range"
            min="1"
            max="20"
            value={numLines}
            onChange={(e) => setNumLines(parseInt(e.target.value))}
            className="w-32"
          />
          <span className="ml-2">{numLines}</span>
        </div>

        <button
          onClick={regenerateLines}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Regenerate Lines
        </button>
      </div>

      <div className="relative border border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          width={boxSize.width}
          height={boxSize.height}
          className="block"
        />
      </div>

      <div className="mt-4 text-sm">
        <p className="font-semibold">Algorithm Summary:</p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Red dots represent the centroids of each region</li>
          <li>Blue lines represent the input segments</li>
          <li>
            Small black dots show all vertices (intersections and endpoints)
          </li>
          <li>
            Colored regions represent the different faces created by the
            intersections
          </li>
        </ul>
      </div>
    </div>
  )
}

export default BoxVisualization
