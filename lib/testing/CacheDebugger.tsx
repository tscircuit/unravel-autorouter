import { getGlobalLocalStorageCache } from "lib/cache/setupGlobalCaches"
import { CacheProvider } from "lib/cache/types"
import { useState } from "react"

export const CacheDebugger = ({
  cacheProvider,
}: {
  cacheProvider: CacheProvider | null
}) => {
  const [forceUpdates, setForceUpdate] = useState(0)

  const numberOfCacheKeys = cacheProvider?.getAllCacheKeys()?.length ?? 0

  if (!cacheProvider) {
    return <div>No Cache Provider Selected</div>
  }

  return (
    <details>
      <summary>Cache Debugger</summary>
      <div>Cache Name: {(cacheProvider as any).constructor.name}</div>
      <div>Cache: Global Local Storage Cache</div>
      <div>Number of cache keys: {numberOfCacheKeys}</div>
      <div>Cache Hits: {cacheProvider.cacheHits}</div>
      <div>Cache Misses: {cacheProvider.cacheMisses}</div>
      <button
        onClick={() => {
          cacheProvider.clearCache()
          setForceUpdate(forceUpdates + 1)
        }}
      >
        clear cache
      </button>
    </details>
  )
}
