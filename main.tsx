import React from "react"
import ReactDOM from "react-dom/client"
import { InteractiveGraphics } from "graphics-debug/react"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InteractiveGraphics
      graphics={{
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
      }}
    />
  </React.StrictMode>,
)
