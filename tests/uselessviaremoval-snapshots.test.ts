import { expect, test } from "bun:test"
import { UselessViaRemovalSolver } from "lib/solvers/UselessViaRemovalSolver/UselessViaRemovalSolver"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { GraphicsObject } from "graphics-debug"

// Convert a GraphicsObject to SVG for snapshot testing
function graphicsObjectToSvg(graphics: GraphicsObject, width = 200, height = 200): string {
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`
  
  // Add background grid for better visualization
  svg += `  <rect width="${width}" height="${height}" fill="#f0f0f0" />\n`
  svg += `  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" stroke-width="0.5" />
  </pattern>
  <rect width="${width}" height="${height}" fill="url(#grid)" />\n`
  
  // Add lines
  if (graphics.lines) {
    for (const line of graphics.lines) {
      if (!line.points || line.points.length < 2) continue
      
      // Create path for the line
      let d = `M ${line.points[0].x} ${line.points[0].y}`
      for (let i = 1; i < line.points.length; i++) {
        d += ` L ${line.points[i].x} ${line.points[i].y}`
      }
      
      svg += `  <path d="${d}" stroke="${line.strokeColor || 'black'}" stroke-width="${line.strokeWidth || 1}" fill="none" ${line.strokeDash ? `stroke-dasharray="${line.strokeDash}"` : ''} />\n`
    }
  }
  
  // Add circles for vias
  if (graphics.circles) {
    for (const circle of graphics.circles) {
      svg += `  <circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="${circle.fill || 'black'}" stroke="black" stroke-width="0.5" />\n`
    }
  }
  
  svg += `</svg>`
  return svg
}

// Test case 1: Two crossing routes
test("UselessViaRemovalSolver fixture 1 - crossing routes", async () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "route1",
      route: [
        { x: 10, y: 10, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 90, y: 90, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
    {
      connectionName: "route2",
      route: [
        { x: 10, y: 90, z: 0 },
        { x: 50, y: 50, z: 0 },
        { x: 50, y: 50, z: 1 },
        { x: 90, y: 10, z: 1 },
      ],
      vias: [{ x: 50, y: 50 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
    route2: "#0000ff",
  }
  
  // Before optimization
  const beforeSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...new UselessViaRemovalSolver({ routes: [...routes], colorMap }).visualize()
  })
  
  // After optimization
  const solver = new UselessViaRemovalSolver({ routes, colorMap })
  solver.solve()
  
  const afterSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...solver.visualize()
  })
  
  // Create before and after comparison SVG
  const comparisonSvg = `
  <svg width="420" height="200" xmlns="http://www.w3.org/2000/svg">
    <text x="75" y="15" font-family="Arial" font-size="12">Before Optimization</text>
    <text x="285" y="15" font-family="Arial" font-size="12">After Optimization</text>
    <g transform="translate(10,20)">${beforeSvg}</g>
    <g transform="translate(220,20)">${afterSvg}</g>
  </svg>
  `
  
  await expect(comparisonSvg).toMatchSvgSnapshot(`${import.meta.path}-fixture1`)
})

// Test case 2: Redundant layer change that immediately reverts
test("UselessViaRemovalSolver fixture 2 - redundant layer change", async () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      connectionName: "route1",
      route: [
        { x: 10, y: 10, z: 0 },
        { x: 30, y: 30, z: 0 },
        { x: 50, y: 50, z: 1 }, // Unnecessary layer change
        { x: 70, y: 70, z: 0 },
        { x: 90, y: 90, z: 0 },
      ],
      vias: [
        { x: 50, y: 50 },
      ],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
  }
  
  // Before optimization
  const beforeSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...new UselessViaRemovalSolver({ routes: [...routes], colorMap }).visualize()
  })
  
  // After optimization
  const solver = new UselessViaRemovalSolver({ routes, colorMap })
  solver.solve()
  
  const afterSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...solver.visualize()
  })
  
  // Create before and after comparison SVG
  const comparisonSvg = `
  <svg width="420" height="200" xmlns="http://www.w3.org/2000/svg">
    <text x="75" y="15" font-family="Arial" font-size="12">Before Optimization</text>
    <text x="285" y="15" font-family="Arial" font-size="12">After Optimization</text>
    <g transform="translate(10,20)">${beforeSvg}</g>
    <g transform="translate(220,20)">${afterSvg}</g>
  </svg>
  `
  
  await expect(comparisonSvg).toMatchSvgSnapshot(`${import.meta.path}-fixture2`)
})

// Test case 3: L-shaped route with unnecessary layer change
test("UselessViaRemovalSolver fixture 3 - L-shaped route", async () => {
  const routes: HighDensityIntraNodeRoute[] = [
    {
      // An L-shaped route with an unnecessary layer change
      connectionName: "route1",
      route: [
        { x: 10, y: 90, z: 0 },  // Starting point
        { x: 50, y: 90, z: 0 },  // Horizontal segment
        { x: 50, y: 90, z: 1 },  // Unnecessary layer change
        { x: 50, y: 50, z: 1 },  // Vertical segment
      ],
      vias: [{ x: 50, y: 90 }],
      traceThickness: 5,
      viaDiameter: 8,
    },
  ]

  const obstacles: HighDensityIntraNodeRoute[] = [
    {
      // Red obstacle rectangle
      connectionName: "obstacle1",
      route: [
        { x: 20, y: 20, z: 0 },
        { x: 80, y: 20, z: 0 },
        { x: 80, y: 40, z: 0 },
        { x: 20, y: 40, z: 0 },
        { x: 20, y: 20, z: 0 },
      ],
      vias: [],
      traceThickness: 2,
      viaDiameter: 0,
    },
  ]

  const colorMap = {
    route1: "#ff0000",
    obstacle1: "#ff0000",
  }
  
  // Before optimization
  const beforeSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...new UselessViaRemovalSolver({ routes: [...routes, ...obstacles], colorMap }).visualize()
  })
  
  // After optimization
  const solver = new UselessViaRemovalSolver({ routes: [...routes, ...obstacles], colorMap })
  solver.solve()
  
  const afterSvg = graphicsObjectToSvg({
    lines: [],
    points: [],
    circles: [],
    rects: [],
    ...solver.visualize()
  })
  
  // Create before and after comparison SVG
  const comparisonSvg = `
  <svg width="420" height="200" xmlns="http://www.w3.org/2000/svg">
    <text x="75" y="15" font-family="Arial" font-size="12">Before Optimization</text>
    <text x="285" y="15" font-family="Arial" font-size="12">After Optimization</text>
    <g transform="translate(10,20)">${beforeSvg}</g>
    <g transform="translate(220,20)">${afterSvg}</g>
  </svg>
  `
  
  await expect(comparisonSvg).toMatchSvgSnapshot(`${import.meta.path}-fixture3`)
}) 