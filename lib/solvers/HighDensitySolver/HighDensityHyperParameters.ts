export interface HighDensityHyperParameters {
  FUTURE_CONNECTION_PROX_TRACE_PENALTY_FACTOR: number
  FUTURE_CONNECTION_PROX_VIA_PENALTY_FACTOR: number
  FUTURE_CONNECTION_PROXIMITY_VD: number
  MISALIGNED_DIST_PENALTY_FACTOR: number
  VIA_PENALTY_FACTOR_2: number
  SHUFFLE_SEED: number
  CELL_SIZE_FACTOR: number
  FLIP_TRACE_ALIGNMENT_DIRECTION: boolean

  // Hyper Parameters for Multi-Head Polyline Solver
  MULTI_HEAD_POLYLINE_SOLVER: boolean
  SEGMENTS_PER_POLYLINE: number
  BOUNDARY_PADDING: number

  ITERATION_PENALTY: number

  //  NEW  – minimum gap that still counts as success when no perfect
  //  solution is found (checked only at the very end, never used
  //  as a normal “solved” criterion during the search)
  MINIMUM_FINAL_ACCEPTANCE_GAP?: number
}
