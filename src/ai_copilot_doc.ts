import { ArchitectureSection } from "./architecture_doc";

export const AI_COPILOT_SECTIONS: ArchitectureSection[] = [
  {
    id: "ai-core-architecture",
    title: "29. AI Engine Architecture, Multi-Agent & RAG",
    category: "AI Copilot Engine",
    shortDescription: "Core multi-agent orchestrator, hybrid cloud/local model pipelines, semantic memory layer, and Retrieval-Augmented Generation (RAG) (Topics 1-10).",
    markdown: `# 29. AI Engine Architecture, Multi-Agent & RAG

This document defines the underlying multi-agent architectural blueprint of the NovaSim AI Copilot and Autonomous Modeling Engine.

---

## 29.1 Core AI Architecture & Multi-Agent Framework (Topics 1, 2 & 3)

### 1. Purpose
Provides an intelligent orchestrator that acts as an expert industrial engineer, translating natural language prompts and legacy structured documents into valid, simulated factory models.

### 2. Internal Architecture
The engine uses an asymmetric **Multi-Agent Orchestrator** framework. Requests are routed through a coordinator which delegates tasks to specialized micro-agents:
* **Layout Agent**: Translates geometric spatial requests.
* **Kinematics Agent**: Configures robotics and path loops.
* **Operational Agent**: Models process timelines, schedules, and OEE.
* **Validation Agent**: Inspects model validity and guarantees numerical stability.

\`\`\`
                  [ User Input Prompt / CAD / Excel ]
                                  |
                                  v
                   [ Multi-Agent Orchestrator ]
                     /       |          \\        \\
         [Layout Agent] [Kinematics] [Operational] [Validation]
                     \\       |          /        /
                      v      v          v       v
                     [ Unified Simulation Model ]
\`\`\`

### 3. Data Flow
1. User submits text, Excel, or CAD layout.
2. The orchestrator routes the request to the **RAG Engine** for context injection.
3. Sub-agents execute parallel planning passes, writing to a transient memory blackboard.
4. Validation Agent audits the output against the simulation schema.
5. The verified JSON model is pushed to the Client 3D canvas via high-speed WebSockets.

### 4. Algorithms
* **Hierarchical Planning and Task Decomposition**: Recursively breaks down a complex factory prompt (e.g., "build an automotive chassis cell with 3 robotic welders and a buffer conveyor") into serialized, manageable schema updates.

### 5. AI Models
* **Cloud**: Gemini 2.5 Pro (for reasoning and complex layout synthesis) and Gemini 2.5 Flash (for real-time conversation and quick queries).
* **Local**: Specialized fine-tuned Mistral-7B models running on local edge nodes for offline workspaces.

### 6. User Interaction
An interactive split-screen chatbot interface sits adjacent to the 3D viewport, allowing users to enter text prompts, view step-by-step agent thoughts, and approve modifications with a single click.

---

## 29.2 AI Memory & Knowledge Retrieval (Topics 4, 5, 6, 7 & 8)

### 1. Purpose
Empowers the AI with long-term memory of layout design habits, project histories, and company-specific manufacturing guidelines.

### 2. Internal Design
* **Vector Store Embeddings**: Converts industrial guidelines and CAD descriptions into 1536-dimensional vectors.
* **Semantic Cache Layer**: Matches prompt signatures against a localized Redis cache to bypass expensive LLM computation.

### 3. Mathematical Model
Cosine Similarity matching for context retrieval:
$$\\text{Score} = \\frac{\\vec{A} \\cdot \\vec{B}}{\\|\\vec{A}\\| \\|\\vec{B}\\|}$$

### 4. Data Structures
\`\`\`cpp
struct SemanticMemoryNode {
    UUID node_id;
    float embedding_vector[1536];
    char metadata_json[2048];
    uint64_t timestamp;
};
\`\`\`

### 5. Security
Strict role-based access controls (RBAC) ensure that private company schemas are never mixed with shared public training datasets.
`
  },
  {
    id: "ai-nl-engineering",
    title: "30. Natural Language Engineering & Automated Generation",
    category: "AI Copilot Engine",
    shortDescription: "Text-to-model synthesis, processing Excel/CSV parameters, CAD layout parsing, and industrial domain terminology translation (Topics 11-24).",
    markdown: `# 30. Natural Language Engineering & Automated Generation

This specification details the parser pipelines that convert text, CAD layouts, and spreadsheet records into structured, functional factory simulations.

---

## 30.1 Multi-Source Simulation Synthesis (Topics 11, 12, 13, 14, 15 & 16)

### 1. Purpose
Enables automated modeling by ingestion of existing industrial documents, diagrams, and layout blueprints.

### 2. Internal Design
* **Multimodal CAD Processor**: Extracts layer labels and coordinates of physical machinery from DXF/DWG file streams.
* **ERP/MES Connector**: Translates cycle times, raw material inputs, and production demands into active parameter configurations.

\`\`\`
       [ CAD Layout DXF ] -> [ Spatial Coordinates Parser ] \\
                                                            +-> [ AI Model Generator ]
       [ ERP/MES Spreadsheet ] -> [ Parameter Extractor ]   /           |
                                                                        v
                                                            [ 3D Functional Factory ]
\`\`\`

### 3. Algorithms
* **Heuristic Spatial Clustering**: Groups isolated 2D lines and text markers from CAD exports into discrete, bounded physical machine bounding boxes.

### 4. Data Structures
\`\`\`cpp
struct ExtractedMachineGeometry {
    char source_layer[64];
    float centroid_position[3];
    float bounding_box_dimensions[3];
    float rotation_angle;
    char predicted_class[128]; // e.g., "Conveyor", "6-Axis Robot"
};
\`\`\`

---

## 30.2 AI Object Generation & Process Routing (Topics 17 - 24)

### 1. Purpose
Constructs the simulation layout, connects components dynamically, generates material routes, and configures physical device speeds.

### 2. Internal Design
* **Graph Routing Solver**: Projects spatial connections onto a directed acyclic graph (DAG), optimizing the flow of parts across production islands.
* **Operator Scheduler**: Models human operator shifts and breaks based on labor laws and company policies.

### 3. Mathematical Model
Part distribution routing using probability transition matrices:
$$P = \\begin{bmatrix} P_{11} & P_{12} & \\dots & P_{1n} \\\\ P_{21} & P_{22} & \\dots & P_{2n} \\\\ \\vdots & \\vdots & \\ddots & \\vdots \\\\ P_{n1} & P_{n2} & \\dots & P_{nn} \\end{bmatrix}$$
where $\\sum_{j=1}^{n} P_{ij} = 1$, representing branching probabilities at dynamic sorting gates.

### 4. Error Handling
If the generated process flow results in an unrouted node or dead-end, the Validation Agent triggers a correction loop, adding bypass buffers or adjusting routing rules automatically.
`
  },
  {
    id: "ai-optimization-diagnostics",
    title: "31. AI Optimization, Bottlenecks & Self-Healing",
    category: "AI Copilot Engine",
    shortDescription: "Throughput optimization, layout improvements, WIP reduction, cycle-time adjustments, logic debugging, and automatic error resolution (Topics 25-36).",
    markdown: `# 31. AI Optimization, Bottlenecks & Self-Healing

This document specifies the closed-loop diagnostic and self-healing algorithms that maximize Overall Equipment Effectiveness (OEE) and eliminate simulated factory bottlenecks.

---

## 31.1 Bottleneck Detection & Line Balancing (Topics 25, 26 & 27)

### 1. Purpose
Analyzes running simulations, pinpoints starved or blocked machinery, and suggests high-impact physical adjustments.

### 2. Internal Design
The optimization engine uses a continuous **Graph Bottleneck Analyzer** that tracks machine states (Working, Blocked, Starved, Down) in real-time.

\`\`\`
    [ Machine 01: Working ] ---> [ Machine 02: Blocked ] ---> [ Machine 03: Starved ]
            (95% Load)                  (100% Load)                 (10% Load)
                                             ^
                                             |  <-- AI detects bottleneck
                                             v
                               [ Suggestion: Insert Buffer ]
\`\`\`

### 3. Mathematical Model
Overall Equipment Effectiveness (OEE) optimization:
$$\\text{OEE} = \\text{Availability} \\times \\text{Performance} \\times \\text{Quality}$$
To balance a line with $N$ stations and total task time $T$, the cycle time $C$ target is evaluated as:
$$C \\ge \\max_{i} (t_{\\text{station } i})$$

### 4. Algorithms
* **Reinforcement Learning Layout Optimizer**: Employs Proximal Policy Optimization (PPO) agents to iterate on component placement, reducing operator walking times and path conflicts while maximizing safety clearances.

---

## 31.2 AI Debugging, Logic Validation & Auto-Repair (Topics 32 - 36)

### 1. Purpose
Detects and repairs logical flaws (such as buffer deadlock loops or unreachable material flows) during simulation execution.

### 2. Internal Design
The **Self-Healing Loop** monitors system warnings. Simple syntax errors are resolved instantly, while complex logical layout failures trigger an explanatory toast card alongside a split-viewport comparison of the proposed fix.

### 3. Data Structures
\`\`\`cpp
struct SimulationErrorLog {
    uint32_t error_code;
    char subsystem_id[64];
    char error_severity[16]; // "Critical", "Warning"
    char source_object_uuid[64];
    char logic_explanation[512];
    char suggested_patch_json[2048];
};
\`\`\`

### 4. Failure Scenarios
* **Infinite Re-route loop**: Two conveyors face each other, creating an infinite routing circle.
* *Mitigation*: The analyzer flags circular paths and inserts a diverted bypass conveyor.
`
  },
  {
    id: "ai-reporting-performance",
    title: "32. Predictive Reporting, Memory Orchestration & Roadmap",
    category: "AI Copilot Engine",
    shortDescription: "Executive summaries, KPI forecasting, performance orchestration, model versioning pipelines, and the future expansion roadmap (Topics 37-50).",
    markdown: `# 32. Predictive Reporting, Memory Orchestration & Roadmap

This document defines the output capabilities, container security frameworks, and future roadmap of the AI Copilot Engine.

---

## 32.1 Predictive Reporting & KPI Analytics (Topics 37 - 42)

### 1. Purpose
Transforms raw simulation logs into executive summaries, PowerPoint-style slides, and high-impact graphs.

### 2. Internal Design
* **Report Synthesizer**: Generates markdown and JSON structures containing key stats (Throughput, WIP, Buffer utilization), converting them into PDF or presentation files.
* **Predictive Insights Engine**: Employs time-series forecasting models to predict long-term wear, tear, and maintenance schedules of virtual machines.

\`\`\`
+-----------------------------------------------------------+
|              KPI PREDICTIVE INSIGHTS                      |
|                                                           |
|    Simulated Days:   [ Day 1 ]   [ Day 10 ]   [ Day 30 ]  |
|    WIP Level:        [ Low   ]   [ Med    ]   [ High   ]  |
|                                                     |     |
|    AI Forecast -------------------------------------+     |
|    Result: High risk of congestion at Sorting Gate B.      |
+-----------------------------------------------------------+
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct ReportMetaData {
    char project_id[64];
    uint64_t simulated_cycles;
    float peak_throughput_per_hour;
    float average_oee;
    char recommendation_bullets[4][256];
};
\`\`\`

---

## 32.2 Performance Orchestration, Security & Roadmap (Topics 43 - 50)

### 1. Purpose
Ensures rapid AI response times, manages system updates, and outlines the long-term technology trajectory.

### 2. Internal Design
* **Model Versioning Control**: Employs git-like version tracking for simulation layouts, letting users easily roll back AI-suggested changes.
* **Secure Sandbox Execution**: LLM-generated code runs inside isolated containers, ensuring safety against malicious script execution.

### 3. Future AI Roadmap
* **v2.1 (Multi-Modal Vision Inspection)**: Let users snap a smartphone photo of a real-world factory line, immediately generating a corresponding 3D layout in the canvas.
* **v2.2 (Decentralized Edge Orchestration)**: Syncs local model instances across multi-terminal control rooms, allowing teams to collaborate in real-time.
`
  }
];
