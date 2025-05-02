import { CacheProvider } from "./types"

/**
 * An in-memory implementation of the CacheProvider interface.
 * Useful for testing or scenarios where persistence is not required.
 */
export class InMemoryCache implements CacheProvider {
  isSyncCache = true
  cacheHits = 0
  cacheMisses = 0

  private cache: Map<string, any> = new Map()

  /**
   * Retrieves a cached solution synchronously based on the cache key.
   * Increments cache hit/miss counters.
   * @param cacheKey The key to look up in the cache.
   * @returns The cached solution if found, otherwise undefined.
   */
  getCachedSolutionSync(cacheKey: string): any {
    console.log("getting", cacheKey)
    const cachedSolution = this.cache.get(cacheKey)
    if (cachedSolution !== undefined) {
      this.cacheHits++
      // Return a structured clone to prevent accidental modification of the cached object
      return structuredClone(cachedSolution)
    } else {
      this.cacheMisses++
      return undefined
    }
  }

  /**
   * Retrieves a cached solution asynchronously. Wraps the synchronous method.
   * @param cacheKey The key to look up in the cache.
   * @returns A promise that resolves with the cached solution or undefined.
   */
  async getCachedSolution(cacheKey: string): Promise<any> {
    return this.getCachedSolutionSync(cacheKey)
  }

  /**
   * Stores a solution in the cache synchronously.
   * Uses structured cloning to store a copy, preventing external modifications.
   * @param cacheKey The key under which to store the solution.
   * @param cachedSolution The solution data to cache.
   */
  setCachedSolutionSync(cacheKey: string, cachedSolution: any): void {
    console.log("setting", cacheKey)
    // Store a structured clone to prevent external modification of the cached object
    this.cache.set(cacheKey, structuredClone(cachedSolution))
  }

  /**
   * Stores a solution in the cache asynchronously. Wraps the synchronous method.
   * @param cacheKey The key under which to store the solution.
   * @param cachedSolution The solution data to cache.
   * @returns A promise that resolves when the solution is cached.
   */
  async setCachedSolution(
    cacheKey: string,
    cachedSolution: any,
  ): Promise<void> {
    this.setCachedSolutionSync(cacheKey, cachedSolution)
  }

  /**
   * Clears the entire cache and resets hit/miss counters.
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
  }
}

// Add global declare for globalThis to fix types
declare global {
  // eslint-disable-next-line no-var
  var TSCIRCUIT_AUTOROUTER_IN_MEMORY_CACHE: InMemoryCache
}

globalThis.TSCIRCUIT_AUTOROUTER_IN_MEMORY_CACHE = new InMemoryCache()
