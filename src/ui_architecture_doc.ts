import { ArchitectureSection } from "./architecture_doc";

export const UI_ARCHITECTURE_SECTIONS: ArchitectureSection[] = [
  {
    id: "ui-philosophy-mainwindow",
    title: "14. UI Philosophy & Workspace Layout",
    category: "Visual Editor & UI/UX",
    shortDescription: "Ergonomic framework, Main Window blueprint, docking panel states, and global layouts (Topics 1-3).",
    markdown: `# 14. UI Philosophy & Workspace Layout

This document establishes the official UI/UX design specifications for the NovaSim AI Visual Editor, an elite industrial simulation application.

---

## 14.1 Overall UI Philosophy (Topic 1)

NovaSim AI is engineered for maximum user efficiency, bypassing the archaic, cluttered tool layouts of legacy tools (e.g. FlexSim, AnyLogic).

### Ergonomic Core Principles
* **Context-Driven Disclosure**: Panels, menus, and inspectors dynamically fade into view based on selection states. Unrelated buttons are kept hidden to prevent cognitive overload.
* **Pixel-Perfect Alignment Grid**: A strict 4px grid system aligns all labels, borders, inputs, and canvas widgets to maintain a cohesive, professional appearance.
* **Sub-5ms Hotkey Latency**: Every action is mapped to low-latency local handlers, prioritizing raw execution speed.
* **Universal High-Contrast Access**: Icons use distinct geometric signatures to ensure readability for colorblind users, supported by full screen-reader compliance.

---

## 14.2 Main Window Anatomy & Ribbon Interface (Topic 2)

The main application screen features a streamlined, non-overlapping grid layout.

  \`\`\`
+-----------------------------------------------------------------------------------------+
| [Menu Bar] File  Edit  View  Objects  Simulation  AI  Tools  Window  Help  [Quick Access]|
+-----------------------------------------------------------------------------------------+
| [Ribbon Tab]  File   |  Build  |  Analyze  |  Run  |  AI Copilot  |  Integrations        |
|  [Group: Flow] Src, Q, Proc  [Group: Run Controls] Play, Pause, Stop, Step, TimeScale   |
+-----------------------------------------------------------------------------------------+
| [Left Panel]       | [Center Workspace]                               | [Right Panel]   |
|                    |                                                  |                 |
| Project Explorer   |                 3D / 2D Canvas                   | Property Panel  |
|  - System Graph    |                                                  |  - Basic / Adv  |
|  - Resources       |                                                  |  - Validation   |
|                    |                                                  |                 |
| Object Library     |                                                  |                 |
|  - Drag & Drop     |                                                  |                 |
+--------------------+--------------------------------------------------+-----------------+
| [Bottom Drawer] Console  |  Event Log  |  AI Assistant Console  |  Telemetry Charts     |
+-----------------------------------------------------------------------------------------+
| [Status Bar]  ● CONNECTED  |  SimClock: 1248.52 s  |  FPS: 60  |  NUMA Node 0 Active     |
+-----------------------------------------------------------------------------------------+
  \`\`\`

### 1. Ribbon and Tabs System
* **Home / Build Tab**: Contains quick-access object tools grouped by class (Flow, Vehicles, Material Handling, Robotic Cells).
* **Simulation Run Panel**:
  * \`Run\` / \`Pause\` / \`Stop\`: Controls active simulation execution.
  * \`Step\`: Pops and executes a single event from the FEL, advancing the clock to its precise timestamp.
  * \`Fast-Forward\`: Disables canvas rendering updates, running the execution loop at maximum CPU processing speed.
  * \`Time-Scale Slider\`: Logarithmic scaling from $0.1\times$ to $1000\times$ real-world speed.
* **AI Copilot Tab**: Includes automated layout optimization tools, script diagnostics, and draft report generation buttons.

### 2. Side Panels and Docking Layouts
* **Left Panel: Project Explorer**: Displays a clear hierarchical tree structure of the model graph, including logical layers, resources, and custom variables.
* **Right Panel: Properties & Parameters**: A context-sensitive inspector that updates instantly when any object, node, or connection is selected.
* **Bottom Panel: Console & Event Tracer**: Displays system messages and provides live event-by-event logging for deep model verification.

---

## 14.3 Multi-Monitor Docking System (Topic 3)

The user interface uses a **Lock-Free Layout Engine** to provide fluid workspace configuration.

### Floating and Docking Mechanics
* **Drop Zones**: Dragging any panel tab triggers 5-way visual drop targets (Top, Left, Right, Bottom, Center) to assist with clean docking.
* **Detached Windows**: Any inspector or chart panel can be detached into a floating OS-level window, fully supporting multi-monitor configurations.
* **Workspace Presets**:
  * \`Build Mode\`: Maximizes the Object Library and 3D View canvas.
  * \`Debug Mode\`: Opens the Event Log, Active Resource Queue queues, and Script Editor.
  * \`Analysis Mode\`: Focuses on live Recharts graphs, statistical confidence metrics, and Excel/SQL export controls.
`
  },
  {
    id: "ui-objects-scene-editor",
    title: "15. Object Library UI & 3D Scene Editor",
    category: "Visual Editor & UI/UX",
    shortDescription: "Object drag-and-drop workflows, 3D viewport navigation, transform Gizmos, and selection systems (Topics 4-6).",
    markdown: `# 15. Object Library UI & 3D Scene Editor

This specification governs the search, selection, placement, and kinematic modification of simulation assets within 3D Space.

---

## 15.1 Object Library User Interface (Topic 4)

Provides access to the extensive manufacturing, logistics, and robotic model libraries.

### Layout & Ergonomics
* **Hierarchical Sidebar**: Collapsible folders organize assets by category: \`Flow Systems\`, \`Material Handling\`, \`Mobile Resources\`, \`Warehousing\`, \`Robotics\`.
* **Instant Filter**: Full-text searching indexing descriptions, aliases, and metadata tags in under 1ms.
* **Hover Card Preview**: Hovering over an object triggers a floating tooltip showing a 3D animated thumbnail, port specifications, and validation rules.
* **Favorites Shelf**: Users can drag frequently used or customized objects into a persistent Quick Build toolbox.

---

## 15.2 3D Viewport & Navigation Mechanics (Topic 5)

The viewport is powered by WebGL2 / WebGPU, supporting fluid CAD navigation workflows.

### Camera Controls & Viewing Angles
* **Orbit**: Held \`RMB + Drag\` rotates the camera around the active cursor pivot point.
* **Pan**: Held \`MMB + Drag\` shifts the view plane horizontally and vertically.
* **Zoom**: \`Scroll Wheel\` scales the camera view distance smoothly, dynamically adjusting scroll speed based on distance to prevent clipping.
* **Standard Orthographic Views**: High-speed hotkeys switch viewports instantly between Front, Side, Top-Down, Perspective, and Iso-metric angles.

### Grid Positioning, Snapping & Alignment
* **Smart Snap Grid**: Grid sizes scale dynamically between 0.1m, 0.5m, 1.0m, and 5.0m intervals based on zoom depth.
* **Connection Auto-Routing**: Placing a node (e.g. a conveyor) within a 0.5m radius of an existing output port highlights the port green, auto-snapping and routing the path on mouse release.
* **Spatial Alignment Toolbar**: Enables quick alignment of multiple selected machines along a common axis (Align Left, Center, Grid Snap, Equal Spacing).

---

## 15.3 Object Selection & Transformation Gizmos (Topic 6)

The canvas selection engine provides clean control over dense layouts.

  \`\`\`
+---------------------------------------------------------+
|                  TRANSFORM GIZMO                        |
|                                                         |
|                     ^  +Z (Move Up)                     |
|                     |                                   |
|                     |    / +Y (Rotate)                  |
|                     |   /                               |
|                     |  /                                |
|    -X <-------------+-------------> +X (Move Left/Right)|
|                    / \                                  |
|                   /   \                                 |
|                  v     v                                |
|               ScaleX  ScaleY                            |
+---------------------------------------------------------+
  \`\`\`

### Selection Methods
* **Single Click Selection**: Selecting an asset highlights its bounds with an elegant blue outline and activates the translation gizmos.
* **Rectangle/Box Selection**: Holding \`LMB + Drag\` draws a semi-transparent selection marquee, capturing all assets inside the box boundaries.
* **Lasso Selection**: Holding \`Alt + LMB + Drag\` enables custom freeform boundary selection to help isolate assets in dense layouts.
* **Filters Checklist**: Allows users to filter selection targets to avoid accidentally moving static elements (e.g., Selecting operators only while locking conveyor lines).
* **Lock & Hide Controls**: Locks selected elements to prevent edits, or hides them from the viewport to clean up multi-level building views.
`
  },
  {
    id: "ui-interactions-properties",
    title: "16. Interactions, Shortcuts & Property Editor",
    category: "Visual Editor & UI/UX",
    shortDescription: "Right-click context menus, basic and advanced property tabs, shortcuts matrix, and input mappings (Topics 7-16).",
    markdown: `# 16. Interactions, Shortcuts & Property Editor

This document defines the interface controls, context menus, input modes, and high-productivity keyboard shortcuts.

---

## 16.1 Right-Click Context Menus (Topic 7)

Provides context-sensitive controls based on the selected asset:

* **General Context Menu**:
  * \`Run Simulation to this Event\`: Fast-forwards the clock directly to the next scheduled event for this specific object.
  * \`Toggle Port Visualizers\`: Displays directional arrows showing active inlet and outlet pathways.
  * \`Connect / Link Ports\`: Enters path-routing mode.
* **Vehicle / Operator Context Menu**:
  * \`Trace Path\`: Draws a persistent color-coded line showing the vehicle's dynamic routing history.
  * \`View Status Registry\`: Displays raw variables (Current speed, battery level, task queue).
* **Conveyor Context Menu**:
  * \`Inspect Accumulation Zones\`: Highlights blocked cells along the line in bright red.

---

## 16.2 Property Editor & Parameter Management (Topic 8)

The Right Inspector Panel manages parameters in real-time.

### Ergonomic Modes
* **Basic Mode**: Simple, user-friendly forms for core variables: Processing Times (dropdown), Resource Counts (slider), Routing Rules (dropdown).
* **Advanced Mode**: Full JSON parameter editing, letting advanced users write custom scripts, assign priority functions, and define preemption behaviors.
* **Parameter Filtering**: A search bar at the top of the panel dynamically filters parameters, highlighting matches inside collapsed panels.
* **Integrated Unit Conversions**: Input fields support auto-conversions: entering \`25 min\`, \`1.5 hr\`, or \`1200 s\` automatically normalizes to seconds in the simulation solver.

---

## 16.3 Keyboard & Mouse Shortcuts Matrix (Topic 11 & 12)

A comprehensive physical shortcut matrix ensures rapid, keyboard-driven workflows.

### 1. Viewport & Navigation Mappings
| Key Command | Action Mapping | Context Scope |
| :--- | :--- | :--- |
| \`W\`, \`A\`, \`S\`, \`D\` | Pan camera forward/left/backward/right | Viewport Active |
| \`Q\`, \`E\` | Rotate camera angle left and right | Viewport Active |
| \`F\` | Center focus camera on the active selection | Global |
| \`P\` / \`O\` | Toggle Perspective / Orthographic cameras | Global |
| \`Spacebar\` | Pause / Resume simulation loop | Running State |

### 2. Core Editing Shortcuts
| Key Command | Action Mapping | Context Scope |
| :--- | :--- | :--- |
| \`Ctrl + Z\` / \`Ctrl + Y\` | Undo / Redo last transaction step | Editor Active |
| \`Ctrl + D\` | Duplicate selected entities at cursor offsets | Build Mode |
| \`Del\` / \`Backspace\` | Delete selected entities and remove links | Build Mode |
| \`Ctrl + G\` / \`Ctrl + U\` | Group / Ungroup selected objects | Build Mode |
| \`L\` | Enter Port Link connection mode | Build Mode |
| \`Escape\` | Exit active tool, connection mode, or selection | Global |

---

## 16.4 Alternative Input Ergonomics (Topics 13 - 16)

NovaSim AI fully supports modern hardware and field deployment tablets:

* **Tablet & Touch Mappings**:
  * *Two-finger Pinch*: Zooms viewport smoothly.
  * *Two-finger Drag*: Pans camera across the floor layout.
  * *Single-finger Tap & Hold*: Opens the context menu at the touch location.
* **Stylus / Pen Mode**: Uses pressure-sensitive drawing inputs to sketch layout routes or paths, which are automatically snapped to the underlying grid.
* **Intelligent Drag-and-Drop**: Dragging an asset over an active connection line highlights the line green. Releasing the mouse breaks the line and inserts the new node in-between automatically.
`
  },
  {
    id: "ui-ai-assistant-projects",
    title: "17. AI Copilot Integration & Project Management",
    category: "Visual Editor & UI/UX",
    shortDescription: "Conversational AI assistant panels, warnings panel, version history, and cloud collaboration (Topics 17-20).",
    markdown: `# 17. AI Copilot Integration & Project Management

This specification details the interface, conversational widgets, and project controls that power our AI-assisted engineering workflow.

---

## 17.1 AI Assistant Panel & Controls (Topic 17)

The integrated **CTO AI Copilot** has full read/write access to the model's System Graph and variables.

  \`\`\`
+-----------------------------------------------------------------+
|                        CTO AI COPILOT                           |
+-----------------------------------------------------------------+
|  🤖 Ask me about layout optimizations, bottleneck resolution,  |
|     distribution adjustments, or logic failures.               |
+-----------------------------------------------------------------+
|  [ User Prompt Box ]                                            |
|  "The sorting line keeps getting blocked. Fix layout."          |
+-----------------------------------------------------------------+
|  💡 Recommendations:                                            |
|   1. Increase downstream accumulation conveyor length by 2.4m.  |
|   2. Upgrade SCARA sorting cycle rate to 0.4 seconds.           |
|                                                                 |
|  [Apply Optimization]  [Discard]  [Simulate and Compare]       |
+-----------------------------------------------------------------+
  \`\`\`

### Core Interactive Workflows
* **Automated Model Builder**: Users can describe a line in plain text (e.g., *"Set up a source feeding a FIFO queue of capacity 20, leading to two parallel inspection stations"*), and the AI compiles the graph and places the matching 3D objects automatically.
* **Stochastic Performance Optimization**: The AI scans OEE metrics and suggests localized adjustments (e.g. tuning conveyor speeds or rearranging operator paths) to clear bottlenecks.
* **One-Click Layout Optimization**: Evaluates the spatial placement of machines and routes, automatically rearranging them to minimize travel distances for operators and vehicles.

---

## 17.2 Notifications & Warning System (Topic 18)

Standardized notification banners provide clear system feedback:

* **Error Banners (Red)**: Alerts users to critical failures that halt simulation execution (e.g., Circular path loops, negative variables, syntax errors).
* **Warning Cards (Amber)**: Highlights potential design flaws that could skew statistics (e.g., Queues with infinite capacity, unlinked machine output ports, overlapping spatial layouts).
* **Success Flash (Green)**: Confirms successful file operations, complete simulation replications, or active database updates.
* **Optimization Card (Blue)**: Highlights AI-generated optimization recommendations ready for review.

---

## 17.3 Project Management & Cloud Workspace (Topic 19 & 20)

NovaSim AI features a comprehensive project dashboard for local and cloud environments:

* **Project Dashboard**:
  * **Templates Panel**: Access pre-configured blueprints for common layouts (e.g., Cross-docking terminals, automotive assembly loops, pharmaceutical packaging cells).
  * **Local / Cloud Tabs**: Seamlessly switch between local storage files and collaborative cloud-hosted models.
* **Version History Panel**: Shows a visual chronological timeline of all model saves, allowing users to compare branches and roll back changes instantly.
* **Concurrent Collaborative Sessions**: Displays active cursors and annotations of other connected team members on the shared 3D canvas in real-time.
`
  }
];
