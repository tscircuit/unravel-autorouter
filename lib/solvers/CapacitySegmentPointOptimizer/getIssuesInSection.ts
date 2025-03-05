import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"
import { UnravelSection, UnravelIssue } from "./types"

export const getIssuesInSection = (
  section: UnravelSection,
  nodeMap: Map<CapacityMeshNodeId, CapacityMeshNode>,
): UnravelIssue[] => {
  const issues: UnravelIssue[] = []

  // Find all issues in the section

  return issues
}
