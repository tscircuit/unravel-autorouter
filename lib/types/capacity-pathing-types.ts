import type { CapacityMeshNodeId } from "./capacity-mesh-types"

export type CapacityPathId = string

export interface CapacityPath {
  capacityPathId: CapacityPathId
  nodeIds: CapacityMeshNodeId[]
}

export interface UsedCapacityMap {
  [capacityMeshNodeId: CapacityMeshNodeId]: number
}
