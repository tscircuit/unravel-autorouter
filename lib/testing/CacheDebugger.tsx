import { getGlobalLocalStorageCache } from "lib/cache/setupGlobalCaches"
import { useState } from "react"

export const CacheDebugger = () => {
  const localStorageCache = getGlobalLocalStorageCache()
  const [forceUpdates, setForceUpdate] = useState(0)

  let numberOfCacheKeys = 0
  for (let i = 0; i < 10_000; i++) {
    const keyName = localStorage.key(i)
    if (!keyName) break
    if (!keyName.includes(":")) continue
    numberOfCacheKeys++
  }

  return (
    <details>
      <summary>Cache Debugger</summary>
      <div>Cache: Global Local Storage Cache</div>
      <div>Number of cache keys: {numberOfCacheKeys}</div>
      <div>Cache Hits: {localStorageCache.cacheHits}</div>
      <div>Cache Misses: {localStorageCache.cacheMisses}</div>
      <button
        onClick={() => {
          localStorageCache.clearCache()
          setForceUpdate(forceUpdates + 1)
        }}
      >
        clear cache
      </button>
    </details>
  )
}
