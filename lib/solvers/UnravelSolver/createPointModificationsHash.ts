import { SegmentPointId } from "../CapacitySegmentPointOptimizer/types"

export const createPointModificationsHash = (
  pointModifications: Map<
    SegmentPointId,
    { x?: number; y?: number; z?: number }
  >,
) => {
  return Array.from(pointModifications.entries())
    .map(([id, { x, y, z }]) => `${id}(${x ?? ""},${y ?? ""},${z ?? ""})`)
    .sort()
    .join("&")
}
