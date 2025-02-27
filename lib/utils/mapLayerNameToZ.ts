export const mapLayerNameToZ = (layerName: string, layerCount: number) => {
  if (layerName === "top") return 0
  if (layerName === "bottom") return layerCount - 1
  return parseInt(layerName.slice(5))
}
