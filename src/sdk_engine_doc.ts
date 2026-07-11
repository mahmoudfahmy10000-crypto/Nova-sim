import { ArchitectureSection } from "./architecture_doc";

export const SDK_ENGINE_SECTIONS: ArchitectureSection[] = [
  {
    id: "sdk-scripting-sandbox",
    title: "46. Enterprise Scripting Engine & Sandboxing",
    category: "Extensibility",
    shortDescription: "Secure sandboxed runtime environment, lock-free fiber schedules, script life-cycle loops, and recovery mechanics (Topics 1-10).",
    markdown: `# 46. Enterprise Scripting Engine & Sandboxing

This specification details the foundational Scripting Engine of NovaSim AI, establishing secure, multi-threaded, fiber-level task execution with robust fault isolation.

---

## 46.1 Scripting Runtime & Sandboxed Execution Pipeline (Topics 1 - 5)

### 1. Purpose
Empowers engineers to write custom control logic, layout generators, and behavior sequences that execute dynamically alongside the high-performance simulation loop without risking core thread stability or security.

### 2. Internal Architecture
The runtime leverages a **Sandboxed Fiber-Scheduler (SFS)** pattern:
* **The VM Supervisor**: Manages a pool of lightweight execution virtual machines (V8 for JS, LuaJIT for Lua, PyPy for Python).
* **The Fiber Scheduler**: Multiplexes thousands of script fibers across a limited pool of hardware worker threads, avoiding operating system context-switching overheads.
* **The Secure Interceptor Layer**: Replaces native system calls (filesystem, network, process control) with secure virtual wrappers.

\`\`\`
  [ Script Ingestion ] ──> [ AST Parser / Bytecode Compiler ] ──> [ VM Supervisor ]
                                                                        │
       [ Sim Engine State ] <── [ mTLS Event Bus ] <── [ Secure Interceptor Layer ]
\`\`\`

### 3. Data Flow
1. Scripts are compiled to optimized bytecodes (V8 bytecode or LuaJIT bytecode) upon import.
2. The VM Supervisor instantiates a sandboxed heap block, enforcing hard memory caps.
3. Fibers yield execution cooperatively during asynchronous delays or periodic time-slices (preemptive scheduling).
4. State mutations are queued and sent to the core simulation loop via an atomic shared-memory event bus.

### 4. Algorithms
* **Time-Slice Preemptive Scheduling**: The interpreter inserts periodic hook checks (every $10,000$ bytecodes) to interrupt runaways and verify CPU budgets.
* **Lock-Free Circular Ring Buffer**: Facilitates low-latency communication between scripts and the physical simulation state database.

### 5. Mathematical Model
Memory allocation upper bounds are verified prior to execution:
$$M_{\text{heap}} \le M_{\text{limit}}, \quad C_{\text{cpu}} = \sum_{i=1}^{N} \Delta t_i \le C_{\text{budget}}$$
Yield rate optimizer for multi-fiber pipelines:
$$\text{Yield Frequency } F_y = \alpha \times N_{\text{active_fibers}} + \beta \times \frac{1}{\text{Frame Rate}}$$

### 6. Data Structures
\`\`\`cpp
struct ScriptFiberContext {
    uint64_t fiber_id;
    uint32_t state; // 0: READY, 1: RUNNING, 2: SUSPENDED, 3: TERMINATED
    uint64_t instruction_pointer;
    size_t stack_pointer;
    size_t heap_allocated_bytes;
    uint64_t execution_time_budget_ns;
    uint64_t accrued_execution_time_ns;
};
\`\`\`

### 7. APIs
* **Fiber Life-cycle Manager**:
  \`\`\`protobuf
  rpc CreateFiber(ScriptPayload) returns (FiberStatus);
  rpc TerminateFiber(FiberIdentifier) returns (OperationResult);
  \`\`\`

### 8. Security
* Complete system-call virtualization. Memory-mapped I/O blocks prevent scripts from executing side-channel attacks on adjacent virtual machines.

---

## 46.2 Event-Driven Scripts & Recovery Pipelines (Topics 6 - 10)

### 1. Purpose
Enables dynamic asynchronous scripts that trigger on explicit simulation events or wall-clock schedules, ensuring automatic self-healing when runtime crashes occur.

### 2. Execution Model
* **Event Dispatch Engine**: Matches simulation state changes (e.g., conveyor blockage, part completion) to script callbacks with $O(1)$ complexity.
* **Background Async Co-Processor**: Offloads heavy data import, network requests, or model training tasks away from primary simulation loops.
* **Self-Healing Supervisor**: Detects uncaught exceptions or resource exhaustion, gracefully resetting running sandboxes to clean snapshots.

\`\`\`
 [ Event Trigger ] ──> [ Event Queue (Ring Buffer) ] ──> [ Dispatcher ] ──> [ Script Callback ]
                                                                                   │
 [ Hot State Swap ] <── [ Reset Snapshots ] <── [ Supervisor Diagnostic ] <────────┘
\`\`\`

### 3. Error Handling
* **Stale State Recovery**: If an exception is caught, the supervisor immediately reverts modified state vectors to the last valid transaction checkpoint, raises a warning toast in the developer UI, and attempts a hot-restart of the script fiber.

### 4. Performance
* Maximum event routing overhead $\le 2.5\text{ microseconds}$.
* Sandboxed execution isolation guarantees that a crashing script cannot impact simulation engine thread speed.
`
  },
  {
    id: "sdk-languages-apis",
    title: "47. Multi-Language Support & Object API Interface",
    category: "Extensibility",
    shortDescription: "Python, JS, C++, and Lua interoperability layers, CLI controllers, and high-performance Object CRUD APIs (Topics 11-30).",
    markdown: `# 47. Multi-Language Support & Object API Interface

This specification details the polyglot bindings, network socket APIs, and programmatic simulation interaction layers of NovaSim AI.

---

## 47.1 Multi-Language Bindings & Network APIs (Topics 11 - 20)

### 1. Purpose
Allows developers to utilize their preferred programming ecosystems (Python for data science, C# for corporate automation, C++ for performance plugins, and Lua for fast embedded scripts) to drive the simulation engine.

### 2. Internal Architecture
* **Language Interop Boundary**: Utilizes highly optimized Foreign Function Interfaces (FFI) to pass binary data structs across memory zones without copy-allocation.
* **High-Speed WebSocket & gRPC Core**: Enables external client scripts to execute commands and retrieve raw telemetry streams over the network.
* **CLI Controller**: Direct command-line automation for headless integrations and server provisioning.

\`\`\`
 [ External Python Script ] ──(gRPC / protobuf)──> [ API Gateway ] ──> [ Native C++ Kernel ]
                                                                              │
 [ Embedded Lua Engine ] ─────(Direct FFI Calls)──────────────────────────────┘
\`\`\`

### 3. Algorithms & Mathematical Models
* **Dynamic Serialization Engine**: Converts internal C++ pointers to JSON/Protocol Buffers using zero-copy memory maps:
  $$\text{Latency}_{\text{serialization}} \propto \text{Size}_{\text{payload}} \times (1 - \text{ZeroCopyFactor})$$
* **Event Buffer Ring-Unpacking**: Unpacks raw stream buffers into typed arrays within client VM memory domains.

### 4. Data Structures
\`\`\`cpp
struct PolyglotValueBuffer {
    uint8_t value_type; // 0: Nil, 1: Bool, 2: Int, 3: Float, 4: String, 5: Array
    union {
        bool b_val;
        int64_t i_val;
        double f_val;
        struct {
            const char* ptr;
            size_t len;
        } s_val;
    } data;
};
\`\`\`

---

## 47.2 Low-Level Object Manipulation & Control APIs (Topics 21 - 30)

### 1. Purpose
Provides standard CRUD methods, kinematics controls, event listeners, graphics pipelines, and AI Copilot bindings.

### 2. Core API Modules
* **Object Manipulation API**: Instantiates, deletes, or groups materials and equipment dynamically.
* **Simulation Control API**: Fast commands to pause, play, step-frame, and accelerate simulation rates ($1\times \rightarrow 100\times$).
* **Statistics & Digital Twin API**: Collects telemetry values and binds them to physical factory devices.

\`\`\`
 [ User Code ] ──> [ CreateObject() ] ──> [ Spatial Index Tree ] ──> [ Physics / Graphics Nodes ]
\`\`\`

### 3. Code Templates (Example: Python SDK Integration)
\`\`\`python
import novasim as ns

def on_conveyor_blocked(event):
    # Retrieve conveyor instance
    conveyor = ns.get_object(event.sender_id)
    print(f"Warning: Conveyor {conveyor.name} blocked! Redirecting AGV.")
    
    # Reroute AGV fleet
    agv_fleet = ns.get_objects_by_type("AGV")
    for agv in agv_fleet:
        agv.set_property("target_routing", "AlternativeRoute_A")

# Initialize SDK and listen to events
ns.initialize(endpoint="localhost:3000")
ns.subscribe("CONVEYOR_BLOCKED", on_conveyor_blocked)
ns.run_loop()
\`\`\`

### 4. Security
* API keys must match localized OAuth2 credentials.
* Scope isolation ensures a script cannot delete protected factory model layers unless granted explicit root privileges.
`
  },
  {
    id: "sdk-automation-toolkits",
    title: "48. Workflow Automation, SDK Toolkit & Testing",
    category: "Extensibility",
    shortDescription: "Scheduled jobs, automated report generation, package manager dependencies, and programmatic testing engines (Topics 31-50).",
    markdown: `# 48. Workflow Automation, SDK Toolkit & Testing

This specification outlines the macro recording engines, package deployment structures, and standard programmatic testing tools.

---

## 48.1 Workflow Automation & Macro Engines (Topics 31 - 40)

### 1. Purpose
Automates manual simulation workflows, records operator action macros, scheduled batch sweeps, and integrates simulation models with enterprise CI/CD systems.

### 2. Internal Architecture
* **The Macro Recorder**: Captures visual editor click, drag, and component creation actions, translating them into executable JavaScript or Python codes.
* **Scheduled Job Scheduler**: Executes periodic simulation health checks or reports automatically.
* **CI/CD Build Runner**: Executes tests headless in pipelines, validating physical configurations before production releases.

\`\`\`
 [ UI Interaction ] ──> [ Event Capture Hook ] ──> [ Macro Translator ] ──> [ JS Script File ]
                                                                                   │
 [ Cloud Storage ] <── [ Output PDF Report ] <── [ Headless Execution ] <──────────┘
\`\`\`

### 3. Data Flow
1. An operator turns on "Record Macro" in the NovaSim visual studio workspace.
2. The UI intercepts drag, parameter adjust, and routing links.
3. The event data is structured as sequential macro operations.
4. Saving the macro compiles an automated layout creation script.
5. In Git repositories, the macro runs in headless mode to guarantee that mechanical layout updates do not violate factory space constraints.

### 4. Algorithms
* **Sequence Compression (Macro Clean)**: Removes redundant coordinates and UI visual adjustments from captured records to leave only functional model changes.

---

## 48.2 Developer SDK & Package Manager (Topics 41 - 50)

### 1. Purpose
Simplifies custom extension development, manages physical model library dependencies, and executes unit/integration test sweeps.

### 2. Package Format & Dependency Resolver
* **NovaSim Package Manager (NPM - NovaSim Package Manager)**: Package descriptors (\`novasim.package.json\`) outlining dependencies, assets, CAD nodes, and scripts.
* **Directed Acyclic Graph (DAG) Solver**: Resolves nested dependency versions, downloading modules securely from global enterprise registries.

\`\`\`
 [ App Package ] ──> [ Resolves Dependency DAG ] ──> [ Downloads Modules ] ──> [ VM Runtime ]
\`\`\`

### 3. Data Structures
\`\`\`json
{
  "name": "@enterprise/custom-conveyor-belt",
  "version": "1.4.2",
  "description": "High-speed sorting belt script extension with built-in sensors.",
  "main": "dist/index.js",
  "dependencies": {
    "@novasim/core-sensors": "^2.1.0",
    "@novasim/physics-helpers": ">=3.0.1"
  },
  "permissions": {
    "network": ["https://api.internal-factory.com"],
    "fileSystem": []
  }
}
\`\`\`

### 4. APIs
* **Package Commands**:
  \`\`\`bash
  novasim install @enterprise/custom-conveyor-belt
  novasim test --headless --coverage
  \`\`\`

### 5. Performance Strategy
* Direct incremental hot-reloads during script development keep compile delays under $100\text{ ms}$.
`
  },
  {
    id: "sdk-debugging-security-roadmap",
    title: "49. Debugging Console, Security Policies & Future Roadmap",
    category: "Extensibility",
    shortDescription: "In-browser code editors, breakpoint managers, strict sandboxing limits, audit logging, and 10-year platform evolution pathways (Topics 51-80).",
    markdown: `# 49. Debugging Console, Security Policies & Future Roadmap

This specification defines the developer UI workspace, strict API security boundaries, audit registers, and the long-term platform development roadmap.

---

## 49.1 Integrated Developer Environment & Debugger Console (Topics 51 - 60)

### 1. Purpose
Provides developers with a highly responsive, in-app script editor featuring real-time diagnostic consoles, trace breakpoints, and performance memory profilers.

### 2. User Interface Design
The visual developer tools are mounted directly into a collapsible split-pane console in the workspace, designed for extreme density and rapid navigation:
* **The Script Code Editor**: Features full Monaco Editor integration with native syntax highlighting, automatic autocomplete bindings, and an inline AI assistant.
* **Active Trace Breakpoint Inspector**: Tracks local variables, call stacks, and let users step line-by-line through active execution fibers.
* **Performance Profiler Panel**: Renders real-time CPU thread execution charts and heap memory allocation graphs.

\`\`\`
+-----------------------------------------------------------+
|                      NOVASIM DEV CONSOLE                  |
|                                                           |
|  [Files]  |  1: import novasim as ns                      |
|  main.py  |  2: def on_tick():                            |
|  utils.py |  3:     # BREAKPOINT HERE                     |
|           |  4:     ns.set_speed("conv_1", 2.4)           |
|  +--------+---------------------------------------------+ |
|  | Variables: conv_1.speed = 1.8 | CPU Thread Load: 12% | |
|  | [Step Over] [Resume]          | Heap Size: 14.2 MB   | |
|  +------------------------------------------------------+ |
+-----------------------------------------------------------+
\`\`\`

### 3. Data Flow
1. Setting a breakpoint inserts an asynchronous interrupt opcode into the VM byte-stream.
2. When execution hits the breakpoint, the fiber suspends, sending the local call-stack data to the editor workspace over WebSockets.
3. The editor renders current state parameters, blocking visual simulation steps if synchronous stepping is active.
4. Resuming execution restarts fiber processing.

---

## 49.2 Zero-Trust Security, Governance & Audit Trails (Topics 61 - 70)

### 1. Purpose
Protects industrial OT networks and proprietary intellectual assets by enforcing strict security rules and compliance validation.

### 2. Cyber-Security Measures
* **Zero-Trust Script Isolation**: Every script runs in isolated thread containers with zero access to physical network adapters or native filesystems unless explicit digital certificates are supplied.
* **Wasm & Bytecode Audits**: Static analysis engines inspect downloaded plugin files for dangerous API calls or execution loops prior to compilation.
* **Unyielding Audit Trails**: Cryptographically signed logs tracking every API call, script modification, and simulated control command.

\`\`\`
 [ Third-Party Plugin ] ──> [ Static Analysis Code Inspector ] ──> [ Secure Sandbox Container ]
                                                                             │
 [ System Audit Logs ] <── [ Cryptographic mTLS Signer ] <───────────────────┘
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct SecurityAuditEntry {
    uint64_t log_index;
    uint64_t timestamp_epoch_nanos;
    char operator_user_id[64];
    char script_identifier[128];
    char invoked_api_name[64];
    char payload_sha256[64];
    bool is_authorized_attempt;
};
\`\`\`

---

## 49.3 Platform Technology Roadmap (Topics 71 - 80)

### 1. Purpose
Establishes a 10-year developmental path for the scripting runtime, transitioning from single-node scripting to global autonomous manufacturing fabrics.

### 2. Multi-Year Platform Evolution
* **v1.0 (Core Extensibility)**: Local embedded Lua runtime, standard REST/WebSocket API endpoints, simple layout CRUD actions, and standard text-file script outputs.
* **v2.0 (Dual-Engine Execution)**: Secure V8 JS/TS sandboxing environments, Monaco-based visual script editor, WebSocket-based breakpoint debugger, and full command-line (CLI) tools.
* **v4.0 (Polyglot FFI Bindings)**: Native Python bindings with zero-copy shared memory pipelines, C# and C++ native plugin support, and deep memory performance profilers.
* **v7.0 (AI-Driven Autonomic Engineering)**: Generative script agents that write complex control models, automated bug detection, and secure container sandboxing frameworks.
* **v10.0 (Global Decentralized Factory Fabrics)**: Federated peer-to-peer scripting networks, blockchain-signed secure execution layers, and immersive zero-trust runtime environments.
`
  }
];
