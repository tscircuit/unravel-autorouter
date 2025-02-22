# capacity-node-autorouter

[tscircuit project](https://github.com/tscircuit/tscircuit) &middot; [discord](https://tscircuit.com/join) &middot; [twitter](https://x.com/seveibar) &middot; [try tscircuit online](https://tscircuit.com)

Check out this [short youtube explanation of this autorouter](https://youtu.be/MmTk0806fAo)

## System Diagram

```mermaid
flowchart LR
    subgraph HDR[High Density Route Solver]
        T1[ ] & T2[ ] & T3[ ] & T4[ ] & T5[ ] & T6[ ] & T7[ ] & T8[ ] & T9[ ]
        subgraph IS[HyperSingleIntraNodeSolver / SingleIntraNodeSolver]
            N1[ ] --> N2[ ]
            N2 --> N3[ ]
            N3 --> N4[ ]
            N4 --> N5[ ]
            N5 --> N6[ ]
            N6 --> N7[ ]
            N7 --> N8[ ]
            N8 --> N9[ ]
        end
        subgraph SHDR[SingleHighDensityRouteSolver]
        end
        T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 --> IS
        IS --> SHDR
    end

    NS[Node Solver] --> ES[Edge Solver]
    ES --> MES[Mesh Edge Solver]
    MES --> CPS[Capacity Planning Solver]
    CPS --> EPSS[Edge to Port Segment Solver]
    EPSS --> HDR
```

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```
