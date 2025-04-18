import { CapacityMeshNodeId } from "lib/types"
import { ConnectionPathWithNodes } from "../CapacityPathingSolver/CapacityPathingSolver"

export const calculateNodeProbabilityOfFailureForNode = (
  usedCapacity: number,
  totalCapacity: number,
) => {
  if (usedCapacity < totalCapacity) return 0
  if (totalCapacity < 1 && usedCapacity < 1) return 0

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
  connectionsWithNodes,
}: {
  connectionsWithNodes: Array<{
    connection: { name: string }
    path: CapacityMeshNodeId[]
  }>
  totalNodeCapacityMap: Map<CapacityMeshNodeId, number>
  usedNodeCapacityMap: Map<CapacityMeshNodeId, number>
}) => {
  let logProbabilityOfSuccessSum = 0
  const computedNodes = new Set<CapacityMeshNodeId>()

  for (const connection of connectionsWithNodes) {
    for (const node of connection.path) {
      if (!computedNodes.has(node)) {
        computedNodes.add(node)
        const totalCapacity = totalNodeCapacityMap.get(node) ?? 1
        const usedCapacity = usedNodeCapacityMap.get(node) ?? 0
        const probabilityOfFailure = calculateNodeProbabilityOfFailureForNode(
          usedCapacity,
          totalCapacity,
        )
        const probabilityOfSuccess = 1 - probabilityOfFailure
        logProbabilityOfSuccessSum += Math.log(probabilityOfSuccess)
      }
    }
  }

  return logProbabilityOfSuccessSum
}
