import { CapacityMeshNode, CapacityMeshNodeId } from "lib/types"

interface KdTreeNode {
  node: CapacityMeshNode
  left: KdTreeNode | null
  right: KdTreeNode | null
  depth: number // Track depth of each node
  size: number // Track size of subtree
}

interface RelaxedKdTreeOptions {
  maxDepth?: number
  rebalanceRatio?: number // Ratio that triggers rebalancing
}

/**
 * A Relaxed KD-Tree implementation for CapacityMeshNodes to efficiently
 * find nodes within a certain distance.
 */
export class RelaxedCapacityNodeKdTree {
  private root: KdTreeNode | null = null
  private nodeMap: Map<CapacityMeshNodeId, KdTreeNode> = new Map()
  private maxDepth: number
  private rebalanceRatio: number

  /**
   * Creates a new Relaxed KD-Tree for CapacityMeshNodes
   * @param nodes Initial nodes to add to the tree
   * @param options Configuration options
   */
  constructor(
    nodes: CapacityMeshNode[] = [],
    options: RelaxedKdTreeOptions = {},
  ) {
    this.maxDepth = options.maxDepth || 20
    this.rebalanceRatio = options.rebalanceRatio || 1.5

    // Build tree using bulk operation for better balance
    if (nodes.length > 0) {
      this.buildBalancedTree(nodes)
    }
  }

  /**
   * Builds a balanced tree from an array of nodes
   * @param nodes The array of nodes to build the tree from
   */
  private buildBalancedTree(nodes: CapacityMeshNode[]): void {
    this.root = null
    this.nodeMap.clear()
    this.root = this.buildSubtree(nodes, 0)
  }

  /**
   * Recursively builds a balanced subtree
   * @param nodes Array of nodes to include in the subtree
   * @param depth Current depth in the tree
   * @returns The root of the constructed subtree
   */
  private buildSubtree(
    nodes: CapacityMeshNode[],
    depth: number,
  ): KdTreeNode | null {
    if (nodes.length === 0) {
      return null
    }

    // Sort by the appropriate axis
    const axis = depth % 2
    nodes.sort((a, b) => {
      return axis === 0 ? a.center.x - b.center.x : a.center.y - b.center.y
    })

    // Find median
    const medianIndex = Math.floor(nodes.length / 2)
    const medianNode = nodes[medianIndex]

    // Create new node
    const kdNode: KdTreeNode = {
      node: medianNode,
      left: null,
      right: null,
      depth: depth,
      size: nodes.length,
    }

    // Add to node map
    this.nodeMap.set(medianNode.capacityMeshNodeId, kdNode)

    // Recursively build left and right subtrees
    const leftNodes = nodes.slice(0, medianIndex)
    const rightNodes = nodes.slice(medianIndex + 1)

    kdNode.left = this.buildSubtree(leftNodes, depth + 1)
    kdNode.right = this.buildSubtree(rightNodes, depth + 1)

    return kdNode
  }

  /**
   * Adds a node to the KD-Tree
   * @param node The node to add
   */
  add(node: CapacityMeshNode): void {
    if (this.nodeMap.has(node.capacityMeshNodeId)) {
      return // Node already exists
    }

    const newNode: KdTreeNode = {
      node,
      left: null,
      right: null,
      depth: 0,
      size: 1,
    }

    this.nodeMap.set(node.capacityMeshNodeId, newNode)

    if (!this.root) {
      this.root = newNode
      return
    }

    this.insertNode(this.root, newNode)

    // Check if rebalancing is needed
    if (this.shouldRebalance(this.root)) {
      const allNodes = this.collectAllNodes(this.root)
      this.buildBalancedTree(allNodes)
    }
  }

  /**
   * Determines if the tree should be rebalanced
   * @param node Root node to check for rebalance
   * @returns True if the tree should be rebalanced
   */
  private shouldRebalance(node: KdTreeNode | null): boolean {
    if (!node) return false

    // If depth exceeds maxDepth, we should rebalance
    if (this.getMaxDepth(node) > this.maxDepth) {
      return true
    }

    // Check balance between left and right subtrees
    const leftSize = node.left ? node.left.size : 0
    const rightSize = node.right ? node.right.size : 0

    // If one side is substantially larger than the other, rebalance
    if (leftSize > 0 && rightSize > 0) {
      const ratio =
        Math.max(leftSize, rightSize) / Math.min(leftSize, rightSize)
      return ratio > this.rebalanceRatio
    }

    return false
  }

  /**
   * Gets the maximum depth of a subtree
   * @param node Root of the subtree
   * @returns The maximum depth
   */
  private getMaxDepth(node: KdTreeNode | null): number {
    if (!node) return 0
    return (
      Math.max(this.getMaxDepth(node.left), this.getMaxDepth(node.right)) + 1
    )
  }

  /**
   * Inserts a node into the KD-Tree
   * @param current Current node in traversal
   * @param newNode New node to insert
   */
  private insertNode(current: KdTreeNode, newNode: KdTreeNode): void {
    // Alternate between x and y coordinates based on depth
    const axis = current.depth % 2

    // Update size of current node as we traverse
    current.size++

    // Compare based on the current axis
    const currentPoint =
      axis === 0 ? current.node.center.x : current.node.center.y
    const newPoint = axis === 0 ? newNode.node.center.x : newNode.node.center.y

    // Update depth of the new node
    newNode.depth = current.depth + 1

    if (newPoint < currentPoint) {
      if (current.left === null) {
        current.left = newNode
      } else {
        this.insertNode(current.left, newNode)
      }
    } else {
      if (current.right === null) {
        current.right = newNode
      } else {
        this.insertNode(current.right, newNode)
      }
    }
  }

  /**
   * Removes a node from the KD-Tree
   * @param node The node to remove
   */
  remove(node: CapacityMeshNode): void {
    this.removeById(node.capacityMeshNodeId)
  }

  /**
   * Removes a node from the KD-Tree by its ID
   * @param nodeId The ID of the node to remove
   */
  removeById(nodeId: CapacityMeshNodeId): void {
    if (!this.nodeMap.has(nodeId)) {
      return // Node doesn't exist
    }

    // Get the node to remove
    const nodeToRemove = this.nodeMap.get(nodeId)!
    this.nodeMap.delete(nodeId)

    // Collect all nodes except the one being removed
    const remainingNodes = this.collectAllNodes(this.root, nodeToRemove)

    // Rebuild the tree in a balanced way
    this.buildBalancedTree(remainingNodes)
  }

  /**
   * Collects all nodes in the tree
   * @param root Root of the tree
   * @param nodeToExclude Optional node to exclude
   * @returns Array of all nodes (except the excluded one)
   */
  private collectAllNodes(
    root: KdTreeNode | null,
    nodeToExclude?: KdTreeNode,
  ): CapacityMeshNode[] {
    const result: CapacityMeshNode[] = []

    if (!root) {
      return result
    }

    // In-order traversal to collect nodes
    this.collectNodesTraversal(root, result, nodeToExclude)

    return result
  }

  /**
   * Helper for traversing and collecting nodes
   */
  private collectNodesTraversal(
    node: KdTreeNode | null,
    result: CapacityMeshNode[],
    nodeToExclude?: KdTreeNode,
  ): void {
    if (!node) {
      return
    }

    this.collectNodesTraversal(node.left, result, nodeToExclude)

    if (!nodeToExclude || node !== nodeToExclude) {
      result.push(node.node)
    }

    this.collectNodesTraversal(node.right, result, nodeToExclude)
  }

  /**
   * Gets all nodes within a specified distance of the given node
   * @param node The reference node
   * @param distance The maximum distance to search
   * @returns Array of nodes within the specified distance
   */
  getNodesWithinDistance(
    node: CapacityMeshNode,
    distance: number,
  ): CapacityMeshNode[] {
    const result: CapacityMeshNode[] = []

    if (!this.root) {
      return result
    }

    this.searchNodesWithinDistance(this.root, node, distance, result)
    return result
  }

  /**
   * Helper method to search for nodes within a distance
   */
  private searchNodesWithinDistance(
    current: KdTreeNode | null,
    targetNode: CapacityMeshNode,
    distance: number,
    result: CapacityMeshNode[],
  ): void {
    if (!current) {
      return
    }

    // Check if the current node is within the distance
    if (this.calculateDistance(current.node, targetNode) <= distance) {
      // Don't include the target node itself
      if (current.node.capacityMeshNodeId !== targetNode.capacityMeshNodeId) {
        result.push(current.node)
      }
    }

    // Determine which subtree to search first based on the axis
    const axis = current.depth % 2
    const targetPoint = axis === 0 ? targetNode.center.x : targetNode.center.y
    const currentPoint =
      axis === 0 ? current.node.center.x : current.node.center.y

    const nearerSide = targetPoint < currentPoint ? current.left : current.right
    const furtherSide =
      targetPoint < currentPoint ? current.right : current.left

    // Always search the nearer side
    this.searchNodesWithinDistance(nearerSide, targetNode, distance, result)

    // Only search the further side if it could contain points within the distance
    const axisDistance = Math.abs(targetPoint - currentPoint)
    if (axisDistance <= distance) {
      this.searchNodesWithinDistance(furtherSide, targetNode, distance, result)
    }
  }

  /**
   * Calculates the Euclidean distance between two nodes
   */
  private calculateDistance(
    node1: CapacityMeshNode,
    node2: CapacityMeshNode,
  ): number {
    const dx = node1.center.x - node2.center.x
    const dy = node1.center.y - node2.center.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Gets the total number of nodes in the tree
   */
  getSize(): number {
    return this.root ? this.root.size : 0
  }

  /**
   * Gets statistics about the tree for debugging
   */
  getTreeStats(): { size: number; maxDepth: number; balanced: boolean } {
    const size = this.getSize()
    const maxDepth = this.getMaxDepth(this.root)

    // A perfectly balanced tree has depth of log2(n)
    const idealDepth = Math.ceil(Math.log2(size + 1))
    const balanced = maxDepth <= idealDepth * 1.5

    return { size, maxDepth, balanced }
  }
}
