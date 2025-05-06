import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "lib/testing/ui/menubar" // Assuming shadcn components are here

interface AutoroutingPipelineMenuBarProps {
  renderer: "canvas" | "vector"
  onSetRenderer: (renderer: "canvas" | "vector") => void
  canSelectObjects: boolean
  onSetCanSelectObjects: (canSelect: boolean) => void
  onRunDrcChecks: () => void
  drcErrorCount: number
  animationSpeed: number
  onSetAnimationSpeed: (speed: number) => void
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
    </Menubar>
  )
}
