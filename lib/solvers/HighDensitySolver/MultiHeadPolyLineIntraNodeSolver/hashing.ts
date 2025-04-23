import { PolyLine } from "./types"

export const computePolyLineHash = (
  polyLine: Omit<PolyLine, "hash">,
  cellSize: number,
) => {
  return polyLine.mPoints
    .map(
      (p) =>
        // `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)},${p.z1},${p.z2}`,
        `${p.x},${p.y},${p.z1},${p.z2}`,
    )
    .join("_")
}

export const computeCandidateHash = (
  polyLines: PolyLine[],
  cellSize: number,
) => {
  return polyLines.map((p) => computePolyLineHash(p, cellSize)).join("|")
}

export const createPolyLineWithHash = (
  polyLinePartial: Omit<PolyLine, "hash">,
  cellSize: number,
) => {
  ;(polyLinePartial as any).hash = computePolyLineHash(
    polyLinePartial,
    cellSize,
  )
  return polyLinePartial as PolyLine
}
