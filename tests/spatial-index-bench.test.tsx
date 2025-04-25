import { test } from "bun:test"
import RBush from "rbush"
import Flatbush from "flatbush"
import { Obstacle } from "../lib/types"

const N = 100_000
const N_LEGACY = 10_000
const Q = 1_000

function makeObstacle(b: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}): Obstacle {
  const width = b.maxX - b.minX
  const height = b.maxY - b.minY
  return {
    type: "rect",
    layers: [],
    center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
    width,
    height,
    id: "",
    metadata: {},
    connectedTo: [],
  } as Obstacle
}

// generate one big set and one smaller set
const rawBoxes = Array.from({ length: N }, () => ({
  minX: Math.random() * 1000,
  minY: Math.random() * 1000,
  maxX: Math.random() * 1000 + 1,
  maxY: Math.random() * 1000 + 1,
}))

function randBox() {
  const x = Math.random() * 900
  return { minX: x, minY: x, maxX: x + 100, maxY: x + 100 }
}

test("RBush (bulk load + query)", () => {
  const tree = new RBush<{
    minX: number
    minY: number
    maxX: number
    maxY: number
  }>()
  const t0 = performance.now()
  tree.load(rawBoxes)
  const t1 = performance.now()
  for (let i = 0; i < Q; i++) tree.search(randBox())
  console.log("RBush build:", (t1 - t0).toFixed(1), "ms")
})

test("Flatbush (bulk load + query)", () => {
  const idx = new Flatbush(rawBoxes.length)
  const t0 = performance.now()
  rawBoxes.forEach((b) => idx.add(b.minX, b.minY, b.maxX, b.maxY))
  idx.finish()
  const t1 = performance.now()
  for (let i = 0; i < Q; i++) {
    const { minX, minY, maxX, maxY } = randBox()
    idx.search(minX, minY, maxX, maxY)
  }
  console.log("Flatbush build:", (t1 - t0).toFixed(1), "ms")
})
