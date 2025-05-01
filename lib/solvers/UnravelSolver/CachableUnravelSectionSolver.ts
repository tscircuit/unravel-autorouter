import { CachableSolver, CacheProvider } from "lib/cache/types"
import { UnravelSectionSolver } from "./UnravelSectionSolver"
import { InMemoryCache } from "lib/cache/InMemoryCache"

interface CacheToUnravelSectionTransform {
  // TODO
}
interface CachedSolvedUnravelSection {
  // TODO
}

export class CachableUnravelSectionSolver
  extends UnravelSectionSolver
  implements
    CachableSolver<CacheToUnravelSectionTransform, CachedSolvedUnravelSection>
{
  cacheHit: boolean
  cacheProvider: CacheProvider
  cacheKey?: string | undefined
  cacheToSolveSpaceTransform?: CacheToUnravelSectionTransform | undefined

  constructor(
    params: ConstructorParameters<typeof UnravelSectionSolver>[0] & {
      cacheProvider: CacheProvider
    },
  ) {
    super(params)
    this.cacheProvider = params.cacheProvider
  }

  computeCacheKeyAndTransform(): {
    cacheKey: string
    cacheToSolveSpaceTransform: CacheToUnravelSectionTransform
  } {
    throw new Error("Method not implemented.")
  }

  applyCachedSolution(cachedSolution: CachedSolvedUnravelSection): void {
    throw new Error("Method not implemented.")
  }

  attemptToUseCacheSync(): boolean {
    throw new Error("Method not implemented.")
  }
}
