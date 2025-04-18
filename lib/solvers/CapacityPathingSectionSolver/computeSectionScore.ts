import { CapacityMeshNodeId } from "lib/types"
import { ConnectionPathWithNodes } from "../CapacityPathingSolver/CapacityPathingSolver"

export const calculateNodeProbabilityOfFailureForNode = (
  usedCapacity: number,
  totalCapacity: number,
) => {
  if (usedCapacity < totalCapacity) return 0
  if (totalCapacity < 1 && usedCapacity <= 1) return 0

  const ratioOverTotal = usedCapacity / totalCapacity

  // Tunable parameter to shape the curve
  const k = 2 // increase for steeper approach to 1
  const adjustedRatio = ratioOverTotal - 1

  // This function approaches 1 as adjustedRatio increases
  return 1 - Math.exp(-k * adjustedRatio)
}

/**
 * Returns log(probability of success) for the section. Higher is better.
 */
export const computeSectionScore = ({
  totalNodeCapacityMap,
  usedNodeCapacityMap,
  sectionNodeIds, // Destructure sectionNodeIds here
}: {
  totalNodeCapacityMap: Map<CapacityMeshNodeId, number>
  usedNodeCapacityMap: Map<CapacityMeshNodeId, number>
  sectionNodeIds?: Set<CapacityMeshNodeId> // Optional: Only consider nodes in this set
}) => {
  let logProbabilityOfSuccessSum = 0
  const nodesToConsider = sectionNodeIds ?? new Set(usedNodeCapacityMap.keys()) // Use provided set or all nodes in used map

  for (const nodeId of nodesToConsider) {
    // Skip if node doesn't have capacity info (shouldn't happen if maps are consistent)
    if (!totalNodeCapacityMap.has(nodeId)) continue

    const totalCapacity = totalNodeCapacityMap.get(nodeId)!
    const usedCapacity = usedNodeCapacityMap.get(nodeId) ?? 0

    // Skip calculation if node is not over capacity (prob success = 1, log(1) = 0)
    // This avoids issues with log(0) if probabilityOfSuccess is exactly 1.
    if (usedCapacity <= totalCapacity) continue

    const probabilityOfFailure = calculateNodeProbabilityOfFailureForNode(
      usedCapacity,
      totalCapacity,
    )
    const probabilityOfSuccess = 1 - probabilityOfFailure

    // Avoid log(0) or log(<0) if probabilityOfFailure >= 1
    if (probabilityOfSuccess <= 0) {
      // Assign a very large negative number to represent extremely low probability
      // This handles cases where a node is massively over capacity.
      logProbabilityOfSuccessSum += -1e9 // Or return -Infinity immediately?
    } else {
      logProbabilityOfSuccessSum += Math.log(probabilityOfSuccess)
    }
  }

  return logProbabilityOfSuccessSum
}
