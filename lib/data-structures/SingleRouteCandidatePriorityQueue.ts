export type Node = {
  x: number
  y: number
  z: number

  g: number
  h: number
  f: number

  parent: Node | null
}

export class SingleRouteCandidatePriorityQueue<T extends Node = Node> {
  private heap: T[] = []

  constructor(nodes: T[]) {
    this.heap = []

    for (const node of nodes) {
      this.enqueue(node)
    }
  }

  private getLeftChildIndex(parentIndex: number): number {
    return 2 * parentIndex + 1
  }

  private getRightChildIndex(parentIndex: number): number {
    return 2 * parentIndex + 2
  }

  private getParentIndex(childIndex: number) {
    return Math.floor((childIndex - 1) / 2)
  }

  private hasLeftChild(index: number): boolean {
    return this.getLeftChildIndex(index) < this.heap.length
  }

  private hasRightChild(index: number): boolean {
    return this.getRightChildIndex(index) < this.heap.length
  }

  private hasParent(index: number): boolean {
    return this.getParentIndex(index) >= 0
  }

  private leftChild(index: number): T {
    return this.heap[this.getLeftChildIndex(index)]
  }

  private rightChild(index: number): T {
    return this.heap[this.getRightChildIndex(index)]
  }

  private parent(index: number): T {
    return this.heap[this.getParentIndex(index)]
  }

  private swap(i: number, j: number) {
    const temp = this.heap[i]
    this.heap[i] = this.heap[j]
    this.heap[j] = temp
  }

  // Removing an element will remove the
  // top element with highest priority then
  // heapifyDown will be called
  dequeue(): T | null {
    if (this.heap.length === 0) {
      return null
    }
    const item = this.heap[0]
    this.heap[0] = this.heap[this.heap.length - 1]
    this.heap.pop()
    this.heapifyDown()
    return item
  }

  peek(): T | null {
    if (this.heap.length === 0) {
      return null
    }
    return this.heap[0]
  }

  enqueue(item: T) {
    this.heap.push(item)
    this.heapifyUp()
  }

  heapifyUp() {
    let index = this.heap.length - 1
    while (this.hasParent(index) && this.parent(index).f > this.heap[index].f) {
      this.swap(this.getParentIndex(index), index)
      index = this.getParentIndex(index)
    }
  }

  heapifyDown() {
    let index = 0
    while (this.hasLeftChild(index)) {
      let smallerChildIndex = this.getLeftChildIndex(index)
      if (
        this.hasRightChild(index) &&
        this.rightChild(index).f < this.leftChild(index).f
      ) {
        smallerChildIndex = this.getRightChildIndex(index)
      }
      if (this.heap[index].f < this.heap[smallerChildIndex].f) {
        break
      } else {
        this.swap(index, smallerChildIndex)
      }
      index = smallerChildIndex
    }
  }
}
