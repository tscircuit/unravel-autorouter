import type { GraphicsObject } from "graphics-debug"

export const limitVisualizations = (
  graphicsObject: GraphicsObject,
  objectLimit = 1000,
): GraphicsObject => {
  // Count total objects
  const totalObjects =
    (graphicsObject.points?.length || 0) +
    (graphicsObject.lines?.length || 0) +
    (graphicsObject.circles?.length || 0) +
    (graphicsObject.rects?.length || 0)

  // If under limit, return original
  if (totalObjects <= objectLimit) {
    return graphicsObject
  }

  // Calculate skip factor (percentage of objects to skip)
  const skipFactor = Math.ceil(
    ((totalObjects - objectLimit) / totalObjects) * 100,
  )

  // Filter function that keeps objects based on skipFactor
  const filterBySkipFactor = (_: any, index: number) => {
    return (index * 100) % skipFactor !== 0
  }

  // Create new graphics object with reduced items
  const reduced: GraphicsObject = {
    points: graphicsObject.points
      ? graphicsObject.points.filter(filterBySkipFactor)
      : [],
    lines: graphicsObject.lines
      ? graphicsObject.lines.filter(filterBySkipFactor)
      : [],
    circles: graphicsObject.circles
      ? graphicsObject.circles.filter(filterBySkipFactor)
      : [],
    rects: graphicsObject.rects
      ? graphicsObject.rects.filter(filterBySkipFactor)
      : [],
  }

  return reduced
}
