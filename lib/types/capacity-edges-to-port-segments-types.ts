export interface NodePortSegment {
  capacityMeshNodeId: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  connectionNames: string[]
}
