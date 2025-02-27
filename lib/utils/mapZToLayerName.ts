export const mapZToLayerName = (z: number, layerCount: number) => {
  if (z < 0 || z >= layerCount) {
    throw new Error(`Invalid z "${z}" for layer count: ${layerCount}`)
  }

  if (z === 0) return "top"
  if (z === layerCount - 1) return "bottom"
  return `inner${z}`
}
