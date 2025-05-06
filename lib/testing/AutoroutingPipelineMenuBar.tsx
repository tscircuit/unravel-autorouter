import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "lib/testing/ui/menubar" // Assuming shadcn components are here
import {
  type CacheProviderName,
  cacheProviderNames,
} from "./AutoroutingPipelineDebugger"

const cacheProviders: CacheProviderName[] = [
  "None",
  "In Memory",
  "Local Storage",
]

interface AutoroutingPipelineMenuBarProps {
  renderer: "canvas" | "vector"
  onSetRenderer: (renderer: "canvas" | "vector") => void
  canSelectObjects: boolean
  onSetCanSelectObjects: (canSelect: boolean) => void
  onRunDrcChecks: () => void
  drcErrorCount: number
  animationSpeed: number
  onSetAnimationSpeed: (speed: number) => void
  onSolveToBreakpointClick: () => void
  cacheProviderName: CacheProviderName
  onSetCacheProviderName: (provider: CacheProviderName) => void
  onClearCache: () => void
}

const animationSpeeds = [1, 2, 5, 10, 100, 500, 5000]

export const AutoroutingPipelineMenuBar = ({
  renderer,
  onSetRenderer,
  animationSpeed,
  onSetAnimationSpeed,
  canSelectObjects,
  onSetCanSelectObjects,
  onRunDrcChecks,
  drcErrorCount,
  onSolveToBreakpointClick,
  cacheProviderName,
  onSetCacheProviderName,
  onClearCache,
}: AutoroutingPipelineMenuBarProps) => {
  return (
    <Menubar className="rounded-none border-b border-none px-2 lg:px-4 mb-4">
      <MenubarMenu>
        <MenubarTrigger>Renderer</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onClick={() => onSetRenderer("canvas")}
            disabled={renderer === "canvas"}
          >
            Canvas{" "}
            {renderer === "canvas" && <MenubarShortcut>✓</MenubarShortcut>}
          </MenubarItem>
          <MenubarItem
            onClick={() => onSetRenderer("vector")}
            disabled={renderer === "vector"}
          >
            Vector{" "}
            {renderer === "vector" && <MenubarShortcut>✓</MenubarShortcut>}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Debug</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => onSetCanSelectObjects(!canSelectObjects)}>
            {canSelectObjects ? "Disable" : "Enable"} Object Interaction
            {canSelectObjects && <MenubarShortcut>✓</MenubarShortcut>}
          </MenubarItem>
          <MenubarItem onClick={onSolveToBreakpointClick}>
            Solve to Breakpoint
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onRunDrcChecks}>
            Run DRC Checks{" "}
            {drcErrorCount > 0 && (
              <MenubarShortcut className="text-red-500">
                ({drcErrorCount})
              </MenubarShortcut>
            )}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Animation</MenubarTrigger>
        <MenubarContent>
          {animationSpeeds.map((speed) => (
            <MenubarItem
              key={speed}
              onClick={() => onSetAnimationSpeed(speed)}
              disabled={animationSpeed === speed}
            >
              {speed}x{" "}
              {animationSpeed === speed && <MenubarShortcut>✓</MenubarShortcut>}
            </MenubarItem>
          ))}
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Cache</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>Set Cache Provider</MenubarSubTrigger>
            <MenubarSubContent>
              {cacheProviderNames.map((provider) => (
                <MenubarItem
                  key={provider}
                  onClick={() => onSetCacheProviderName(provider)}
                  disabled={cacheProviderName === provider}
                >
                  {provider}
                  {cacheProviderName === provider && (
                    <MenubarShortcut>✓</MenubarShortcut>
                  )}
                </MenubarItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={onClearCache}>Clear Cache</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
