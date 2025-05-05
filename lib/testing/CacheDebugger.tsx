import { getGlobalLocalStorageCache } from "lib/cache/setupGlobalCaches"

export const CacheDebugger = () => {
  const localStorageCache = getGlobalLocalStorageCache()
  return (
    <details>
      <summary>Cache Debugger</summary>
      <div>Cache: Global Local Storage Cache</div>
      <div>Number of cache keys: TODO</div>{" "}
      <div>Cache Hits: {localStorageCache.cacheHits}</div>
      <div>Cache Misses: {localStorageCache.cacheMisses}</div>
      <button
        onClick={() => {
          localStorageCache.clearCache()
        }}
      >
        clear cache
      </button>
    </details>
  )
}
