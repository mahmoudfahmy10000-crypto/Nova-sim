import { ArchitectureSection } from "./architecture_doc";

export const OBJECT_LIBRARY_SECTIONS: ArchitectureSection[] = [
  {
    id: "obj-part-a-b",
    title: "10. Object Library: Flow & Material Handling",
    category: "Object Library",
    shortDescription: "Industrial-grade specifications for Flow Objects and Material Handling Equipment (Parts A & B).",
    markdown: `# 10. Object Library: Flow & Material Handling

This document specifies the core Flow and Material Handling components of the NovaSim AI Object Library.

---

## 10.1 Flow Objects (Part A)

### 1. Source Node
* **Purpose**: Generates entities (parts, pallets, assemblies) into the simulation system according to scheduled or stochastic arrivals.
* **Internal Architecture**: Bound to a dedicated local timer thread mapped to the Future Event List (FEL). It executes an analytical generator that does not poll but leaps directly between arrival events.
* **Properties & Parameters**:
  * \`arrival_distribution\`: Probability distribution function (\`Exponential\`, \`Weibull\`, \`Normal\`, \`Triangular\`).
  * \`entity_template\`: Configured \`EntityID\` blueprint.
  * \`batch_size\`: Integer count of entities generated per event.
* **Inputs & Outputs**: Input: None. Output: Outbound physical connection pointer.
* **Events & States**:
  * *Events*: \`EntityCreated\`, \`Blocked\`.
  * *States*: \`Generating\`, \`Blocked\` (when downstream node capacity is saturated).
* **Behaviors**: Samples the next inter-arrival time immediately after an entity is sent downstream. If the exit path is blocked, it caches the current entity and enters the \`Blocked\` state.
* **Animation Rules**: Flashes green on creation; pulses red during blocked states.
* **Statistics**: Total entities created, current generation rate, cumulative blocked duration.
* **API**:
  * \`TriggerArrival() -> void\`: Forces manual injection of an entity.
  * \`SetRate(lambda: f64) -> void\`: Adjusts generation frequency on the fly.
* **Validation Rules**: Generates compiler warning if downstream link capacity is 0 and no queue is configured.
* **Connections**: Standard directed line connection to any Queue, Processor, or Conveyor.
* **Performance Considerations**: Uses static pool instantiation to pre-allocate memory for generated entities, avoiding runtime allocations.
* **AI Features**: Analyzes historical arrival patterns to dynamically recommend matching parametric probability distributions.

### 2. Sink Node
* **Purpose**: Safely disposes of entities, recording final cycle times, throughput, and system lifetimes.
* **Internal Architecture**: Frees entity memory back to the Arena allocator and records terminal statistics in a circular telemetry buffer.
* **Properties & Parameters**:
  * \`log_individual_traces\`: Boolean to determine if full paths are written to PostgreSQL.
* **Inputs & Outputs**: Input: Inbound physical link. Output: None.
* **Events & States**:
  * *Events*: \`EntityDestroyed\`, \`TelemetryLogged\`.
  * *States*: \`Disposing\` (active state), \`Idle\`.
* **Behaviors**: Extracts entity state variables, logs execution path, and registers index back to the free-list bitmask.
* **Animation Rules**: Shrinks entity scales to zero over 100ms with a modern fade-out transition.
* **Statistics**: Throughput, average time-in-system, standard deviation of lead times, work-in-progress (WIP) reduction rates.
* **API**:
  * \`GetTerminalMetrics() -> MetricsResult\`: Returns descriptive stat arrays.
* **Validation Rules**: Must possess at least one incoming active connection.
* **Connections**: Terminal node; terminates any directed graph edge.
* **Performance Considerations**: Writes metrics in lock-free batch arrays to minimize thread contention with the UI.

### 3. Queue (Storage & Buffer)
* **Purpose**: Accumulates entities waiting for downstream processors or resources.
* **Internal Architecture**: Holds a lock-free, double-ended array list supporting multi-criteria sort structures.
* **Properties & Parameters**:
  * \`capacity\`: Maximum queue capacity (Integer or Infinite).
  * \`queue_policy\`: Enqueue strategy (\`FIFO\`, \`LIFO\`, \`Priority\`, \`SortedByAttribute\`).
  * \`balking_distribution\`: Probability bounds for immediate entity rejection.
* **Inputs & Outputs**: Input: Inbound link. Output: Outbound physical links.
* **Events & States**:
  * *Events*: \`Enqueued\`, \`Dequeued\`, \`Balked\`, \`Reneged\`.
  * *States*: \`Empty\`, \`Filling\`, \`Full\`.
* **Behaviors**: Evaluates priority rules on entry. If full, incoming entities are redirected to designated balking edges.
* **Animation Rules**: Linearly stacks entities or arranges them in custom 2D grids based on layout properties.
* **Statistics**: Average queue length, maximum queue length, average waiting time, total balked entities.
* **API**:
  * \`GetQueueLength() -> u32\`: Returns active size.
  * \`PurgeQueue() -> void\`: Empties buffer, discarding entities to Sink.
* **Validation Rules**: Capacity must be greater than or equal to 1 (unless set to infinite).

### 4. Processor (Workstation)
* **Purpose**: Represents value-added processing steps that consume time and require resources.
* **Internal Architecture**: Bound to a service channel pattern, mapping process times to downstream FEL delay slots.
* **Properties & Parameters**:
  * \`process_time\`: Stochastic distribution of duration.
  * \`capacity\`: Max concurrent entities allowed to process.
  * \`required_resources\`: Array of requested operators/tools.
* **Inputs & Outputs**: Input: Incoming buffer link. Output: Exit routing link.
* **Events & States**:
  * *Events*: \`ProcessingStarted\`, \`ProcessingFinished\`, \`Preempted\`, \`Broken\`.
  * *States*: \`Idle\`, \`Setup\`, \`Processing\`, \`Blocked\`, \`Down\`.
* **Behaviors**: Requests resources. Once granted, schedules the completion event. If a resource is preempted, it pauses the execution timer.
* **Animation Rules**: Shows a circular radial progress ring and turns amber during breakdowns.
* **Statistics**: Resource utilization, setup times, idle percentages, total units processed.
* **API**:
  * \`TriggerSetup() -> void\`: Manually flags setup transition.

### 5. Delay, Separator, Combiner, Batch & Unbatch Nodes
* **Purpose & Description**:
  * **Delay**: Enforces simple, non-resource-constrained passage time (e.g., drying, cooling).
  * **Separator**: Splits a single incoming composite entity into multiple child entities (e.g., depalletizing).
  * **Combiner**: Assembles multiple separate parts into a single compound entity (e.g., packaging).
  * **Batch & Unbatch**: Temporarily consolidates N items for transport and separates them back at destinations.
* **Internal Architecture**: Separator/Combiner nodes manipulate the logical parent-child trees in the Entity Arena.
* **Animation Rules**: Separators explode single blocks into grouped vectors; Combiners merge multi-colored elements into a unified palette.
* **Validation Rules**: Combiners require multiple inlet links; Separators require distinct outlet paths for components and containers.

### 6. Splitter, Merger, Decision, Router & Transfer Nodes
* **Purpose**: Governs logical branching, conditional paths, and network routing configurations.
* **Behaviors**: Decisions compile attribute formulas at runtime (e.g., \`quality_score < 0.95 ? Scrapped : Passed\`).
* **Performance**: AST compilation executes evaluations in under 2ns per entity.

---

## 10.2 Material Handling Equipment (Part B)

### 1. Conveyor (Roller, Belt, Chain & Accumulating)
* **Purpose**: Models continuous physical transport systems for moving material across space.
* **Internal Architecture**: Divided into linear accumulation cells. Uses an analytical **Event-Driven Conveyor Solver** to evaluate blockages without running a step-by-step distance ticker loop.
* **Properties & Parameters**:
  * \`speed\`: Float representing meters per second.
  * \`length\`: Total physical span.
  * \`accumulation\`: Boolean to enable accumulating rolling behaviors (parts stack behind blockages).
* **Inputs & Outputs**: Input: Inbound entry port. Output: Outbound discharge port.
* **Events & States**:
  * *Events*: \`Entry\`, \`Exit\`, \`Blocked\`, \`AccumulationStarted\`.
  * *States*: \`Empty\`, \`Transporting\`, \`Accumulating\`, \`Stalled\`.
* **Behaviors**: Tracks head and tail positions of all items on the belt. Calculates merge collisions and schedules exit events based on speed and spacing.
* **Animation Rules**: Renders rolling texture motion mapping speed coordinates, shifting items forward dynamically along spline paths.
* **Statistics**: Throughput, average transport time, belt occupancy ratio, total accumulation cycles.
* **Validation Rules**: Combined length of items must not exceed conveyor length.
* **Connections**: Connects via ports to Queues, Diverters, and Turntables.
* **Performance Considerations**: Evaluates collision events only when head items reach exit points, maintaining O(1) updates per transport operation.
* **AI Features**: Predicts downstream buffer blockages and scales conveyor speeds dynamically to save power.

### 2. Lift & Elevator
* **Purpose**: Coordinates vertical material transit across multi-level factory layouts.
* **Behaviors**: Move-to-floor commands are queued using standard elevator logic algorithms (SCAN).

### 3. Turntable, Sorter & Diverter
* **Purpose**: Directs flowing items across converging or diverging physical networks.
* **Behaviors**: Executes angular orientation transitions or piston strokes to divert parts to lateral lanes based on classification attributes.
`
  },
  {
    id: "obj-part-c-d",
    title: "11. Object Library: Mobile Resources & Machines",
    category: "Object Library",
    shortDescription: "Industrial-grade specifications for Mobile Operators, Vehicles, and Production Machines (Parts C & D).",
    markdown: `# 11. Object Library: Mobile Resources & Machines

This document specifies the mobile and mechanical manufacturing components of the NovaSim AI Object Library.

---

## 11.1 Mobile Resources (Part C)

### 1. Operator & Worker
* **Purpose**: Models human operators responsible for machine setups, manual processing, repairs, and visual inspections.
* **Internal Architecture**: Extends the \`DesResource\` class, binding labor pool allocation policies with physical movement velocity over the layout graph.
* **Properties & Parameters**:
  * \`labor_rate\`: Financial cost per hour ($/hr).
  * \`skill_matrix\`: Bitfield detailing machine qualification IDs.
  * \`walking_speed\`: Metres per second speed when traveling between zones.
* **Inputs & Outputs**: Dynamic request channels.
* **Events & States**:
  * *Events*: \`TaskAssigned\`, \`TravelStarted\`, \`WorkFinished\`, \`BreakStarted\`.
  * *States*: \`Idle\`, \`Traveling\`, \`Assisting\`, \`OnBreak\`.
* **Behaviors**: Evaluates work requests based on skill-match priority. Computes A* walking path across network nodes. Operates strictly within Shift Calendar boundaries.
* **Animation Rules**: Staggers movement positions with discrete footstep keyframes along the node spline.
* **Statistics**: Utilization rate, total labor costs incurred, average travel distance, total tasks completed.
* **API**:
  * \`RequestAssistance(machineId: u32, priority: u8) -> bool\`
  * \`SendToBreak() -> void\`
* **Validation Rules**: Walking speed must be greater than 0.

### 2. Forklift, AGV, AMR, Tugger & Pallet Jack
* **Purpose**: Handles heavy material transport across physical shopfloors.
* **Internal Architecture**: Governed by a **Dynamic Pathfinding & Collision-Avoidance Solver** utilizing social-force models to resolve navigation deadlocks.
* **Properties & Parameters**:
  * \`max_velocity\`: Speed limit parameter (m/s).
  * \`battery_capacity_ah\`: Battery capacity in Amp-hours.
  * \`charge_rate\`: Ah per simulation minute.
  * \`discharge_rate\`: Ah consumed per meter traveled.
* **Behaviors**:
  * AMRs perform dynamic free-path routing, recalculating paths if obstacles or other vehicles are blocking the corridor.
  * AGVs follow fixed wire-guided paths, queuing behind preceding vehicles when buffers are full.
* **Animation Rules**: Tilts slightly on curves; forks raise/lower based on loading state.
* **Statistics**: Duty cycle, battery level timeline, total tonnage moved, congestion waiting time.
* **AI Features**: Optimizes fleet routing dynamically using cooperative reinforcement learning agents to minimize congestion on major corridors.

---

## 11.2 Manufacturing Machines (Part D)

### 1. CNC Machine
* **Purpose**: Simulates precision computer numerical control subtractive manufacturing steps.
* **Properties & Parameters**:
  * \`tool_wear_coefficient\`: Floating-point rate representing wear per process hour.
  * \`scrap_rate\`: Probability distribution yielding off-spec parts.
* **Behaviors**: Executes multi-stage cycles. Triggers preventative tool changes stochastically when cumulative wear crosses safe operating thresholds.

### 2. Assembly Station & Packaging Machine
* **Purpose**: Integrates components or encapsulates products into packaging containers.
* **Behaviors**: Requires operator presence and a specific recipe profile. Holds child items in an internal assembly registers before releasing consolidated packaging output.

### 3. Inspection Machine (Metrology & Vision Systems)
* **Purpose**: Performs non-destructive quality audits, routing products based on tolerance checks.
* **Behaviors**: Evaluates quality variables against statistical process control (SPC) standards, triggering alarm states if six-sigma tolerances are violated.

### 4. Specialized Production Cells (Robot, Welding, Painting & Press Cells)
* **Purpose**: Advanced automated cells containing synchronized machinery and kinematic controllers.
* **Internal Architecture**: Implements hierarchical nested sub-graphs within the DES solver.
* **Animation Rules**: Activates rotational or vertical joint movements with particle effects (sparks for welding, colored mist for painting).
* **Statistics**: Overall Equipment Effectiveness (OEE), scrap rates, cycle efficiency.
`
  },
  {
    id: "obj-part-e-f",
    title: "12. Object Library: Warehousing & Robotics",
    category: "Object Library",
    shortDescription: "Industrial-grade specifications for Warehousing Systems and Industrial Robotic Manipulators (Parts E & F).",
    markdown: `# 12. Object Library: Warehousing & Robotics

This document specifies the logistics, storage, and robotic manipulation components of the NovaSim AI Object Library.

---

## 12.1 Warehousing Systems (Part E)

### 1. Storage Rack & Shelf System
* **Purpose**: Provides high-density multi-level vertical inventory storage.
* **Internal Architecture**: Structured as a 3D grid array mapped to physical layout positions: \`Rack[Bay, Level, Slot]\`.
* **Properties & Parameters**:
  * \`grid_dimensions\`: Matrix dimensions \`[Bays, Levels, Slots]\`.
  * \`slot_weight_capacity\`: Maximum weight allowed per slot.
  * \`retrieval_time_profile\`: Time to access slots based on height/depth.
* **Inputs & Outputs**: Inbound/outbound storage requests.
* **Events & States**:
  * *Events*: \`SlotOccupied\`, \`SlotFreed\`, \`WeightOverload\`.
  * *States*: \`Empty\`, \`PartiallyFull\`, \`MaxCapacityReached\`.
* **Behaviors**: Executes slot allocation algorithms (\`Nearest-Available\`, \`Zone-Based\`, \`FIFO-Turnover\`).
* **Animation Rules**: Highlights slots in 3D color codes: Green (Empty), Amber (Occupied), Red (Overloaded).
* **Statistics**: Rack utilization percentage, average storage duration, vertical-transit travel costs.
* **API**:
  * \`StoreEntity(entity: DesEntity, bay: u32, level: u32) -> bool\`
  * \`RetrieveEntity(entityId: u64) -> DesEntity\`
* **Validation Rules**: Entities cannot exceed slot weight capacities.

### 2. Loading Dock, Truck, Trailer & Shipping Container
* **Purpose**: Bridges internal plant logistics with external supply-chain transport vectors.
* **Behaviors**: Coordinates cyclic container staging. Trucks arrive based on logistics calendars, trigger bulk loading of pallets, and leave when capacity or schedule limits are met.

---

## 12.2 Robotic Manipulators (Part F)

### 1. 6-Axis Robotic Manipulator
* **Purpose**: Performs high-speed multi-directional pick-and-place, sorting, and part manipulation.
* **Internal Architecture**: Driven by a localized **Analytical Inverse Kinematics (IK) Solver** that maps Cartesian end-effector targets to joint angles in micro-seconds.
* **Properties & Parameters**:
  * \`payload_capacity_kg\`: Maximum payload.
  * \`max_reach_radius\`: Reach limit in meters.
  * \`joint_speed_limits\`: Array of angular speeds for each of the 6 joints.
* **Inputs & Outputs**: Cartesian coordinates of pick and place buffers.
* **Events & States**:
  * *Events*: \`PickStarted\`, \`PlaceFinished\`, \`CollisionDetected\`.
  * *States*: \`Idle\`, \`MovingToPick\`, \`Gripping\`, \`MovingToPlace\`, \`JointLimitFault\`.
* **Behaviors**: Calculates time-to-travel based on angular joint velocity profiles rather than simple distance/speed, giving true-to-life physical accuracy.
* **Animation Rules**: Updates 3D joint rotations dynamically based on IK outputs with smooth cubic easing interpolation.
* **Statistics**: Energy consumption (kWh), axis wear indexes, total picks per hour, collision logs.
* **AI Features**: Optimizes joint-path trajectories dynamically using deep reinforcement learning to minimize cycle time and energy consumption.
* **Future Expansion**: Add dual-arm collaborative configurations and soft-gripper force sensors.

### 2. SCARA, Delta & Gantry Robots
* **Purpose**: High-speed packaging, assembly, and linear transport.
* **Behaviors**: SCARA and Delta robots model extreme acceleration limits along flat planar paths, simulating high-speed sorting on conveyors.
`
  },
  {
    id: "obj-part-g-h",
    title: "13. Object Library: Utilities & Factory Systems",
    category: "Object Library",
    shortDescription: "Industrial-grade specifications for System Utilities, Factory Layouts, and Kanban Systems (Parts G & H).",
    markdown: `# 13. Object Library: Utilities & Factory Systems

This document specifies control utilities, variables, and high-level lean factory systems of the NovaSim AI Object Library.

---

## 13.1 Control Utilities & Signals (Part G)

### 1. Photo-Eye & Proximity Sensors
* **Purpose**: Detects physical presence of entities along conveyors, tracks, or entry zones.
* **Internal Architecture**: Implements light-ray boundary intersection calculations.
* **Properties & Parameters**:
  * \`trigger_delay\`: Minimum block duration required to change state.
  * \`fail_safe_mode\`: Default output during hardware failure.
* **Behaviors**: Emits a Boolean signal to the global system bus on transit edge crossing, triggering downstream conveyor stops or gate diverts.

### 2. Global Table, Signal & System Variable
* **Purpose**: Coordinates global routing configurations and stores runtime variables.
* **Behaviors**: Functions as an in-memory Key-Value store. Signals trigger asynchronous events across decoupled objects (e.g. Broadcast \`SIG_FIRE_ALARM\` -> Halt all AMRs).

---

## 13.2 Factory Lean Systems (Part H)

### 1. Kanban Loop & Supermarket
* **Purpose**: Implements visual pull-production scheduling systems on the manufacturing floor.
* **Internal Architecture**: Tracks card registries (\`KanbanCard\`) linked to physical material shelves.
* **Properties & Parameters**:
  * \`kanban_count\`: Total circulating cards.
  * \`replenishment_point\`: Minimum inventory level that triggers card release.
* **Inputs & Outputs**: Material consumption inputs, card replenishment outputs.
* **Events & States**:
  * *Events*: \`CardReleased\`, \`StockoutOccurred\`.
  * *States*: \`Stocked\`, \`AwaitingReplenishment\`, \`Stockout\`.
* **Behaviors**: When inventory drops below the replenishment point, a card is detached and sent upstream to trigger production.
* **Animation Rules**: Renders Kanban board slots moving cards from "Waiting" to "In Progress".
* **Statistics**: Average stockout duration, card circulation time, average inventory levels.
* **Validation Rules**: Total cards in circulation must remain constant.

### 2. Production Line, Assembly Line & Quality Gate
* **Purpose**: High-level structural aggregates grouping multiple machines, buffers, and workers.
* **Behaviors**: Coordinates takt time, monitors bottleneck locations automatically, and enforces line balance ratios.
`
  }
];
