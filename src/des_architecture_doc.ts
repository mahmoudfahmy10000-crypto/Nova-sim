import { ArchitectureSection } from "./architecture_doc";

export const DES_ARCHITECTURE_SECTIONS: ArchitectureSection[] = [
  {
    id: "des-overview-engine",
    title: "5. DES Engine Core & Time Controls",
    category: "System Design",
    shortDescription: "Industrial Discrete Event Simulation Core, Future Event List (FEL), Time Management, Clock, and Lifecycles (Topics 1-20).",
    markdown: `# 5. Discrete Event Simulation (DES) Engine Core & Time Controls

This document specifies the commercial-grade, highly scalable Discrete Event Simulation (DES) Engine for NovaSim AI. It is designed to handle industrial models containing millions of concurrent entities and dynamic events.

---

## 5.1 Simulation Engine Overview & Architecture (Topics 1 & 2)

### Responsibilities
The **DES Engine Core** is responsible for the orchestrating of all entities, events, resources, and state variables in the simulation. It drives the discrete execution loop, guarantees safe execution order, handles state transitions, and collects simulation telemetry.

### Inputs
* \`SimulationConfig\`: Setup specifications (Max simulation time, warm-up period, replication count, base random seeds).
* \`SystemGraph\`: DAG modeling the physical topology of resources, queues, and processes.

### Outputs
* \`SimulationStateBuffer\`: Continuous binary memory stream representing instantaneous system states.
* \`TelemetryTelemetryRecord\`: Stream of system-wide metrics (waiting times, resource utilization, throughput).

### Core Executive Loop Algorithm
\`\`\`rust
fn execute_simulation_loop(engine: &mut DesEngine) {
    engine.initialize();
    while engine.clock < engine.max_time && !engine.fel.is_empty() && engine.status == Status::Running {
        // 1. Extract next chronological event
        let event = engine.fel.pop_minimum().unwrap();
        
        // 2. Advance simulation clock to the event time (Time-Leap)
        engine.clock = event.scheduled_time;
        
        // 3. Dispatch and execute event logic
        engine.dispatch_event(event);
        
        // 4. Resolve state updates and trigger conditional routing
        engine.resolve_passive_events();
        
        // 5. Yield metrics if past warm-up period
        if engine.clock >= engine.warmup_period {
            engine.telemetry.record_state(engine.clock);
        }
    }
    engine.finalize();
}
\`\`\`

### Internal Data Structures
* **Dynamic Event Pointer Vector**: Allocates events inside a cache-aligned slab arena to avoid OS allocator overhead.
* **Double-buffered State Register**: Holds active variables (e.g., resource token counts, queue sizes) in contiguous linear arrays.

### Performance & Scalability Considerations
The executive loop must complete each cycle in under 100 nanoseconds. By maintaining local memory locality and preventing thread contention on the clock, we can process upwards of 10 million events per second per thread.

### Error Handling & Recovery
Any event failure triggers a transaction roll-back. The engine maintains a 1-step checkpoint state; if an invalid transition occurs (e.g., negative resource tokens), it rolls back, dumps a core telemetry file, and transitions the engine to a \`SuspendedFault\` state.

---

## 5.2 Event Driven Architecture & Future Event List (Topics 3, 4 & 5)

### Responsibilities
The **Future Event List (FEL)** holds and manages all scheduled future actions in chronological order. It is the absolute heart of the DES scheduler, governing event insertion, removal, and priority evaluation.

### Inputs
* \`ScheduledEvent\`: Includes \`event_id: u64\`, \`scheduled_time: f64\`, \`priority: u8\`, \`event_type: EventEnum\`, \`target_entity_id: u64\`.

### Outputs
* The lowest-timestamp event (\`next_event\`) returned with $O(1)$ lookup performance.

### Heap Algorithm (FEL Insert/Pop)
The FEL is structured as an **aligned 4-ary (Quaternary) Min-Heap** representation inside a flat array. Quaternary heaps outperform binary heaps in cache performance due to shallow tree depth and high cache line utilization.

* **Sift-Up (Insertion)**:
  $$p = \lfloor(i - 1) / 4\rfloor$$
  If \`heap[i].time < heap[p].time\`, swap and recurse.
* **Sift-Down (Deletion/Extraction)**:
  Find the smallest child $c$ among the 4 children:
  $$c_k = 4i + k \quad (k \in \{1, 2, 3, 4\})$$
  Swap with $c$ if \`heap[i].time > heap[c].time\`, and recurse down.

### Internal Data Structures
* **Contiguous Aligned Flat Vector**: Allocates arrays of \`EventSlot\` structures aligned to 64-byte (L1 cache line) boundaries.
* **Secondary Event Map**: An $O(1)$ Hash Map indexing \`event_id\` to heap array positions for rapid cancellation of scheduled failures or repairs.

### Performance & Scalability Strategy
Quaternary min-heaps yield $O(\log_4 N)$ operations. For an FEL containing $10^6$ active events, insertions and extractions require at most 10 heap node comparisons, taking less than 15ns per operation on AVX-equipped cores.

---

## 5.3 Event Priorities, Scheduling & Time Management (Topics 6, 7, 8 & 9)

### Responsibilities
Coordinates precision timing and resolves chronological tie-breakers. This module ensures that when multiple events occur at the exact same tick, they are dispatched strictly according to business priority logic and deterministic tie-breaker constraints.

### Inputs
* Two or more events at \`t_1 == t_2\`.
* Priority mappings: \`UrgentSystem (0) > ResourceRelease (1) > EntityArrival (2) > MetricTick (3)\`.

### Outputs
* Deterministically sorted array of scheduled events.

### Scheduling Tie-Breaker Algorithm
When scheduled times are equal, sorting uses a multi-level criteria evaluation:
$$\text{PriorityScore} = (\text{PriorityClass} \ll 32) \mid (\text{CreationSequence} \ \& \ \text{0xFFFFFFFF})$$
This guarantees **First-In, First-Scheduled (FIFS)** deterministic execution order for identical priorities, avoiding non-deterministic chaos in high-concurrency replications.

### Clock Drift & Leap Protection
The engine uses **High-Precision Dual 64-bit Floating-Point representation**:
$$\text{SimTime} = \text{Ticks} \times \text{TickDelta}$$
To prevent precision loss (clock drift) in massive long-running simulations, the clock scales step-wise:
* It never increments via relative addition (\`t += dt\`).
* It leaps directly to the target event timestamp (\`t = event.time\`).

### Scalability Strategy
The scheduler is bound to a single physical core, while parallel execution queues handle the processing logic. This complete isolation of the clock from the execution threads prevents lock contentions and keeps execution highly scalable.

---

## 5.4 Warm-Up Period & Replication System (Topics 10 & 11)

### Responsibilities
Manages statistical validation, ensures the simulation discards transient startup noise before logging metrics, and drives independent parallel model replications to calculate robust confidence intervals.

### Inputs
* \`WarmupMethod\`: Welch's Moving Average Method configuration parameters.
* \`ReplicationCount\`: Integer designating how many parallel independent runs to execute.

### Outputs
* Statistical significance indicators, mean time-in-system, and variance analysis charts.

### Welch's Transient Detection Algorithm
To determine the optimal warm-up truncation point $d$:
1. Run $R$ replications of length $n$. Let $Y_{ji}$ be the output variable at step $i$ of replication $j$.
2. Calculate the moving average $\bar{Y}_i(w)$ with window size $w$:
   $$\bar{Y}_i(w) = \begin{cases} 
   \frac{1}{2w+1} \sum_{s=-w}^{w} \bar{Y}_{i+s} & \text{if } i \in [w+1, n-w] \\
   \frac{1}{2i-1} \sum_{s=-(i-1)}^{i-1} \bar{Y}_{i+s} & \text{if } i \in [1, w] 
   \end{cases}$$
3. Plot $\bar{Y}_i(w)$ and find index $d$ where the moving average stabilizes.
4. Truncate all telemetry logs prior to simulation clock $d$.

### Internal Data Structures
* **Dynamic Replication State Matrix**: Flat vector holding current metric aggregations across $R$ parallel instances.
* **Independent RNG State Array**: Unique seed arrays assigned to each thread using PCG64 generators to guarantee statistical independence.

### Scalability Strategy
Replications are **embarrassingly parallel**. The replication orchestrator schedules runs across an elastic pool of local worker threads or cloud containers. If $R = 64$ and $P = 8$ physical cores are available, the orchestrator executes batches of 8 simultaneous runs with zero cross-talk, scaling execution linearly.

---

## 5.5 State Machine Controls (Topics 12 - 18)

### Responsibilities
Executes high-performance state transitions for the simulation runtime, handling operations like Reset, Pause, Resume, Stop, Fast-Forward, and Time Scaling without thread deadlock.

### Inputs
* External control signals: \`CMD_INIT\`, \`CMD_RESET\`, \`CMD_PAUSE\`, \`CMD_RESUME\`, \`CMD_STOP\`, \`CMD_FAST_FORWARD\`, \`CMD_SET_SCALE(factor)\`.

### Outputs
* Immediate execution state feedback.

### Time-Scaling & Synchronization Algorithm
To balance performance against visual fidelity, the engine supports dynamic speed multipliers:
$$\\Delta \\text{WallClock} \\times \\text{ScaleFactor} \\ge \\Delta \\text{SimulationTime}$$
* **Fast-Forward Mode**: The engine completely suspends visual rendering updates and frame syncing, processing events as fast as the host processor can compute them (typically yields a $1000\times$ speed boost).
* **Time-Throttled Mode**: An high-resolution sleep loop locks the clock advance to match system clock ticks, enabling real-time inspection.

### Internal State Transition Diagram
The engine implements a **Lock-Free Atomic State Machine**:
* \`Uninitialized\` $\\xrightarrow{\\text{Init}}$ \`Ready\`
* \`Ready\` $\\xrightarrow{\\text{Start}}$ \`Running\`
* \`Running\` $\\xrightleftharpoons[\\text{Resume}]{\\text{Pause}}$ \`Paused\`
* \`Running\` $\\xrightarrow{\\text{Stop}}$ \`Stopped\`
* \`Running\` $\\xrightarrow{\\text{Fault}}$ \`SuspendedFault\`

All state checks utilize atomic bitmasks to ensure that cross-thread controls (e.g. user pressing "Pause" on the React front-end) resolve within 5 microseconds.

---

## 5.6 State Management & Entity Lifecycle (Topics 19 & 20)

### Responsibilities
Allocates and tracks entities (the physical simulation objects, such as parts, orders, or vehicles) and stores variable historical trajectories across simulated space and time.

### Inputs
* \`EntityDef\`: Structural properties (UUID, Entity Type, custom dynamic attributes, current location).

### Outputs
* Trace files detailing the complete spatial-temporal path of selected entities.

### Aligned Memory Object Allocation Algorithm
Entities are managed inside a **Thread-Safe Arena Allocator**:
1. On initialization, the engine pre-allocates a continuous chunk of memory hosting $10^6$ \`Entity\` blocks.
2. Active entities are indexed via a **Dense-to-Sparse ID Array Map** (ECS style).
3. Upon entity destruction, the system simply marks the array index as free and registers it to a free-list bitmask, bypassing standard OS garbage collection and keeping allocation overhead at precisely $O(1)$ with zero runtime fragmentation.

### State Incremental Logging (Delta Tracking)
Instead of copying the entire database state every step, the system outputs an **Incremental State Delta Stream**:
$$\Delta S(t_i) = \{(V_k, \text{newValue}) \mid V_k(t_i) \neq V_k(t_{i-1})\}$$
These deltas are streamed directly to high-speed rings buffers to keep memory footprint bounded.

### Scalability Strategy
By decoupling active entity representations from historical tracking, we can scale to tens of millions of simulated entities. Historical records are immediately streamed to binary logs on disk or compressed in memory using ZSTD, keeping the active heap footprint under 128 megabytes.
`
  },
  {
    id: "des-routing-logic",
    title: "6. Routing, Queues & Operations",
    category: "System Design",
    shortDescription: "Entity creation, routing, resource allocation, queue mechanisms, delay logic, batch/unbatch, split/merge (Topics 21-34).",
    markdown: `# 6. Entity Operations, Routing & Queues

This document describes the mechanics of routing, resource allocation, and processing logic inside the DES Engine.

---

## 6.1 Entity Operations: Creation, Routing & Lifecycles (Topics 21 - 23)

### Responsibilities
Handles entity entry points (Sources), calculates dynamic spatial routing paths along networks, and safely de-allocates entities at exit points (Sinks).

### Inputs
* **Source Node Schedule**: Generation interval distribution (e.g., Exponential with $\lambda = 5$ secs).
* **System Graph Network**: Complete nodal map holding edge distances, capacities, and transit speeds.

### Outputs
* Triggered arrival events scheduled in the FEL.
* Next-node routing selections.

### A* Routing Algorithm with Dynamic Congestion Weights
Routing does not merely look at static distances. To simulate industrial congestion, edge travel costs update dynamically:
$$\text{Cost}(e) = \frac{\text{Length}(e)}{\text{Velocity}(e)} \times \left(1 + \alpha \cdot \left(\frac{N_{\text{active}}(e)}{C(e)}\right)^\beta \right)$$
Where $C(e)$ is edge capacity, $N_{\text{active}}(e)$ is the current entity count on that edge, and $\alpha, \beta$ are congestion scaling constants. 

When an entity departs node $A$ for node $B$, the system computes the optimal shortest path using an **accelerated Fibonacci-Heap-based A\* search** on the weighted graph, scheduling arrival times in the FEL accordingly.

### Internal Data Structures
* **Dynamic Routing Table**: Flat 2D array of next-hop pointers, re-computed on-demand using Floyd-Warshall whenever network topological shifts occur (e.g. dynamic track closures).
* **Congestion Matrix**: Fast, atomic integer array tracking active entity counts across all system paths.

---

## 6.2 Resource Allocation & Release (Topics 24 & 25)

### Responsibilities
Manages system resources (operators, tools, fixtures, machine capacities) by enforcing strict allocation constraints, priority queues, and preemption policies, while preventing deadlocks.

### Inputs
* \`AllocationRequest\`: Includes \`entity_id\`, \`resource_id\`, \`required_tokens\`, \`priority\`, \`preemption_allowed: bool\`.

### Outputs
* \`AllocationResult\`: Either \`Granted(token_pointer)\` or \`Enqueued(position)\`.

### Allocation Preemption Algorithm
When an high-priority entity $E_{\text{high}}$ requests a resource currently fully occupied by $E_{\text{low}}$:
1. If preemption is disabled: $E_{\text{high}}$ enters the resource's waiting queue.
2. If preemption is enabled:
   * Suspend the processing event of $E_{\text{low}}$.
   * Record progress state:
     $$\text{RemainingDelay} = \text{ScheduledEndTime} - \text{CurrentClock}$$
   * Return $E_{\text{low}}$ to the front of the waiting queue.
   * Transfer resource ownership tokens to $E_{\text{high}}$.
   * Schedule $E_{\text{high}}$ execution event.

### Deadlock Prevention Mechanism
To avoid classic circular-wait conditions (e.g., Entity 1 holds Resource A and waits for B; Entity 2 holds Resource B and waits for A), the engine enforces the **Havender's Resource Ordering Principle**:
* All resources are assigned a strict global index ID.
* Entities are forbidden from requesting a resource with index $I_j$ if they currently hold resources with indexes $I_k \ge I_j$.
* If a multi-resource allocation requires out-of-order resources, it must release all current holds and request them as a single, atomic, all-or-nothing transactional package.

### Internal Data Structures
* **Dynamic Resource Registry**: An array of structure-of-arrays holding resource states: total capacity, currently allocated tokens, and lists of entity IDs holding active tokens.
* **Preemption Stack**: Traces suspended entity states to ensure they can resume cleanly upon resource release.

---

## 6.3 Queue & Processing Logic (Topics 26 & 27)

### Responsibilities
Orchestrates entity storage within queues and handles active execution delays (Processing steps).

### Inputs
* Queue policies: \`FIFO\`, \`LIFO\`, \`Priority\`, \`Balking\`, \`Reneging\`.
* Processing limits (Parallel service channels).

### Outputs
* Flow vectors and wait-time statistics.

### Balking & Reneging Stochastic Algorithms
* **Balking (Immediate rejection)**:
  When an entity arrives at a queue, it evaluates current queue length $L$. The probability of balking is:
  $$P(\text{Balk}) = \frac{1}{1 + e^{-k(L - \text{MaxCapacity})}}$$
  If a uniform random draw $U < P(\text{Balk})$, the entity bypasses the queue and routes immediately to a designated "Bypass" or "Failure" node.
* **Reneging (Patience expiration)**:
  Upon entering a queue, the entity draws a patience duration $T_{\text{patience}} \sim \text{Dist}$. It then schedules a \`RenegingEvent\` at:
  $$t_{\text{renege}} = \text{CurrentClock} + T_{\text{patience}}$$
  If the entity is served before $t_{\text{renege}}$, the reneging event is cancelled. If the clock reaches $t_{\text{renege}}$ while still in queue, the entity exits immediately and records a "Reneging telemetry" point.

### Internal Data Structures
* **Dynamic Ring Queue**: Double-ended, ring-buffered structures aligned to cache lines, supporting lock-free concurrent enqueue/dequeue operations.
* **Active Service Registers**: Small arrays storing processing states of servers for fast utilization tracking.

---

## 6.4 Delay, Batching & Flow Operations (Topics 28 - 34)

### Responsibilities
Enforces physical process delays, combines multiple entities (Batching, Merging), and decomposes blocks (Unbatching, Splitting, Conditional Branching).

### Inputs
* \`BatchDef\`: Batch criteria (Batch size, temporal timeout, key-attribute match).
* \`RoutingDecision\`: Tree of conditions or probabilistic branching factors.

### Outputs
* Grouped or divided entity streams.

### Dynamic Batching and Temporal Consolidation Algorithm
To assemble a batch of size $N$ with a maximum wait time $T_{\text{max}}$:
1. Arriving entities enter a specialized batch buffer.
2. If buffer size reaches $N$, or if the simulation clock reaches the scheduled $t_{\text{timeout}}$:
   * Create a new parent entity $E_{\text{parent}}$.
   * Encapsulate the child entity IDs into a contiguous pointer array held within $E_{\text{parent}}$.
   * Consolidate attributes (e.g., $M_{\text{parent}} = \sum M_{\text{child}}$).
   * Dispatch $E_{\text{parent}}$ downstream.
   * Cancel the pending timeout event.

### Probabilistic & Conditional Split Routing
For split routing (Decision nodes), the engine supports:
* **Attribute-based routing**: Evaluate expressions (e.g., \`entity.weight > 50.0 ? Node_A : Node_B\`).
* **Probabilistic splitting**: Draw a random variable $U \sim \text{Uniform}(0, 1)$. If $U < P_i$, route to output channel $i$.
* **State-dependent routing**: Query downstream queue sizes and route to the path of least resistance (Shortest queue).

### Internal Data Structures
* **Hierarchical Assembly Map**: Multi-level tree indexing parent-child relationships for nested batching.
* **Attribute Expression Abstract Syntax Tree (AST)**: Compiled, lightweight stack-machines that evaluate entity conditions in less than 2 nanoseconds.
`
  },
  {
    id: "des-operational-failures",
    title: "7. Operations, Failures & Calendars",
    category: "System Design",
    shortDescription: "Unscheduled failures, repair mechanics, cyclic shifts, breaks, machine downtime, and PM (Topics 35-40).",
    markdown: `# 7. Failures, Repairs & Operational Calendars

This section covers the temporal and operational variations that govern industrial simulation environments, including equipment failures, maintenance cycles, and staffing shifts.

---

## 7.1 Failure and Repair Event Mechanics (Topics 35 & 36)

### Responsibilities
Simulates stochastic equipment breakdowns and maintenance activities, adjusting resource capacities dynamically, preempting active operations, and scheduling repairs.

### Inputs
* **Mean Time To Failure (MTTF)** distribution (e.g., Weibull with shape $\beta$, scale $\eta$).
* **Mean Time To Repair (MTTR)** distribution (e.g., Lognormal).
* Preemption behavior options: \`StopSimulation\`, \`PreemptActiveEntity\`, \`CompleteActiveEntity\`.

### Failure Injection and Queue Preemption Algorithm
Equipment breakdowns are modeled using a continuous scheduling loop:
1. Upon machine activation, draw $T_{\text{fail}} \sim \text{MTTF}$.
2. Schedule a \`MachineFailureEvent\` in the FEL at $t_{\text{fail}} = \text{CurrentClock} + T_{\text{fail}}$.
3. When $t_{\text{fail}}$ fires:
   * Set machine state to \`Failed\`.
   * Clear active capacity tokens to \`0\`.
   * For any entity $E_{\text{active}}$ currently processing on that machine:
     * If preemption is selected: Suspend processing, calculate remaining work, and place $E_{\text{active}}$ into a "Downtime Hold Queue".
   * Draw $T_{\text{repair}} \sim \text{MTTR}$.
   * Schedule a \`MachineRepairCompletedEvent\` at $t_{\text{repair}} = \text{CurrentClock} + T_{\text{repair}}$.
4. When $t_{\text{repair}}$ fires, restore machine capacity, reschedule suspended entities, and draw the next $T_{\text{fail}}$.

### Internal Data Structures
* **Machine State Struct**: Encapsulates atomic flags, operational accumulators, active failures lists, and pointers to current operators.
* **Failure Log Array**: Tracks failure historical intervals for computing empirical Mean-Time-Between-Failures (MTBF).

---

## 7.2 Shift Calendars, Breaks & Staffing Cycles (Topics 37 & 38)

### Responsibilities
Enforces temporal labor policies, managing worker shift changes, rest breaks, and variable availability profiles across multi-day simulation horizons.

### Inputs
* **Shift Profile Matrix**: Weekly timeline arrays (e.g., Shift A: Mon-Fri 08:00-16:00, Shift B: 16:00-24:00, with varying staffing levels).
* **Break Schedule**: Scheduled rest intervals (e.g., 12:00-12:30 daily).

### Staffing Shift-Change Algorithm
A dedicated, continuous calendar scheduler orchestrates shift boundaries:
1. On start, parse weekly shift calendars and compute next boundary timestamp $t_{\text{shift\_end}}$.
2. Schedule a \`ShiftChangeEvent\` at $t_{\text{shift\_end}}$.
3. When the shift change event fires:
   * Fetch incoming team capacity $C_{\text{new}}$ and outgoing capacity $C_{\text{old}}$.
   * Adjust active resource tokens:
     $$\Delta C = C_{\text{new}} - C_{\text{old}}$$
   * If $\Delta C < 0$ (Capacity reduction):
     * If excess workers are free: release idle tokens.
     * If all workers are busy: flag active entities for "Post-Shift Completion" or preempt them to wait for the next shift according to the defined business policy.
   * Compute and schedule the next shift boundary $t_{\text{shift\_start}}$.

### Internal Data Structures
* **Cyclic Shift Map**: 7-day compressed calendar representations stored in bitmasks (minute-level precision) for lightning-fast queries.
* **Worker Resource Pool Registry**: Maps active workers to shifts, tracking individual accumulated hours and labor costs.

### Scalability Strategy
Instead of running a clock ticker, all shift boundaries and rest breaks are calculated analytically ahead of time. This "Analytical Event Leap" allows the engine to skip long empty periods (e.g. weekends) in microseconds, keeping simulation execution efficient regardless of calendar length.

---

## 7.3 Unscheduled Downtime & Preventive Maintenance (Topics 39 & 40)

### Responsibilities
Governs non-failure operational downtime (e.g. tool changes, cleaning) and manages Preventive Maintenance (PM) intervals to optimize machinery lifetime.

### Inputs
* **Downtime Criteria**: Clean intervals (e.g., "every 100 parts processed" or "every 24 running hours").
* **PM Strategy**: Threshold limits, duration patterns.

### Cycle-Count PM Scheduling Algorithm
Preventive maintenance can trigger stochastically or deterministically based on tool wear:
1. Track cumulative process cycles $N_{\text{cycle}}$ on machine $M$.
2. When $N_{\text{cycle}} \ge N_{\text{threshold}}$:
   * If the machine is currently idle: Immediately transition state to \`UndergoingPM\` and lock resource tokens.
   * If the machine is busy: Flag machine as \`PM\_Pending\`. The instant the active entity completes processing, transition state to \`UndergoingPM\`.
3. Draw PM duration $T_{\text{pm}} \sim \text{Dist}$.
4. Schedule \`PMCompletedEvent\` at $t_{\text{pm}} = \text{CurrentClock} + T_{\text{pm}}$.
5. Upon completion, reset cycle count: $N_{\text{cycle}} = 0$.

### Internal Data Structures
* **Wear Accumulator Registers**: Atomic counters logging cumulative running hours, stress cycles, and thermal load factors.
* **Maintenance Event Records**: Store scheduled PM calendars and actual execution timestamps.
`
  },
  {
    id: "des-rng-stats",
    title: "8. RNG, Stats & Math Engine",
    category: "System Design",
    shortDescription: "Ultra-fast random engines (PCG64), 10+ probability distributions, statistical confidence, and validation (Topics 41-43).",
    markdown: `# 8. RNG, Probability Distributions & Math Engine

This document details the mathematical and statistical engine that powers stochastic sampling, confidence intervals, and variance validation in NovaSim AI.

---

## 8.1 High-Performance Random Number Generator (Topic 41)

### Responsibilities
Provides high-performance, statistically pristine, cryptographically robust pseudo-random number generation. It must guarantee complete stream independence across multiple parallel replication threads.

### Inputs
* 64-bit integer seed values (\`seed\`, \`stream\_id\`).

### Outputs
* Raw 64-bit uniformly distributed unsigned integers, scaled floating-point values in $[0, 1)$.

### The PCG-RXS-M-XS-64 Generator Algorithm
NovaSim AI uses the **PCG-RXS-M-XS-64** generator. PCG outperforms traditional Mersenne Twister (MT19937) in memory footprint (16 bytes vs 2500 bytes), CPU performance ($2.5\times$ speedup), and easily passes the stringent TestU01 statistical suite.

The generator tracks state using a 128-bit LCG, applying a variable-size shift-and-multiply permutation to output 64-bit random streams:
$$\text{State}_{n+1} = (\text{State}_n \times a + c) \pmod{2^{128}}$$
$$\text{Output}_n = \text{Permute}(\text{State}_n)$$
Where the permutation combines RXS (random extra shift), M (multiply), and XS (xor-shift) operators:
1. Extract top bits to compute dynamic shift amount.
2. Apply XOR shift on state.
3. Multiply by a 64-bit unsigned prime constant.
4. Output the high 64 bits of the product.

### Internal Data Structures
* **PCG64 State Struct**: Holds the 128-bit internal state value and the 128-bit stream increment value.

### Performance Considerations
By keeping the state struct under 32 bytes, the entire generator fits inside standard CPU registers. This yields raw generation speeds of over 1.2 billion integers per second on average server hardware, with zero memory latency.

---

## 8.2 Stochastic Probability Distributions (Topic 42)

### Responsibilities
Transforms uniform random inputs into specialized continuous and discrete statistical distributions.

### Implemented Distribution Algorithms
The mathematics engine features highly optimized, branch-free sampling implementations:

* **Exponential Distribution**:
  $$X \sim -\frac{1}{\lambda} \ln(U) \quad (U \sim \text{Uniform}(0, 1))$$
* **Normal Distribution (Box-Muller Polar Form)**:
  $$Z_0 = \sqrt{-2\ln(U_1)} \cos(2\pi U_2), \quad Z_1 = \sqrt{-2\ln(U_1)} \sin(2\pi U_2)$$
* **Weibull Distribution**:
  $$X \sim \lambda (-\ln(U))^{1/k} \quad (\text{scale } \lambda, \text{shape } k)$$
* **Erlang Distribution**:
  $$X \sim -\frac{1}{\lambda} \ln\left(\prod_{i=1}^{k} U_i\right)$$
* **Triangular Distribution**:
  $$X = \begin{cases} 
  a + \sqrt{U(b-a)(c-a)} & \text{if } U < \frac{c-a}{b-a} \\
  b - \sqrt{(1-U)(b-a)(b-c)} & \text{otherwise}
  \end{cases}$$
* **Poisson Distribution (Knuth's Method for $\lambda < 30$)**:
  Let $L = e^{-\lambda}$, $k = 0$, $p = 1$. While $p > L$: increment $k$, draw $U \sim \text{Uniform}(0, 1)$, set $p = p \times U$. Return $k - 1$.

### Performance Optimization Strategy
To bypass slow transcendental functions (\`ln\`, \`cos\`, \`sin\`) at runtime, the engine uses **Pre-computed Lookup-table Interpolation** for highly complex distribution profiles (such as empirical histograms), processing samples in less than 5 nanoseconds.

---

## 8.3 Statistical Validation & Autocorrelation Correction (Topic 43)

### Responsibilities
Computes robust statistical metrics (confidence intervals, variance, covariance) and corrects for autocorrelation in time-series telemetry logs.

### Inputs
* Continuous time-series variables $\{X(t) \mid t \in [0, T]\}$.
* Target alpha level (e.g., $\alpha = 0.05$ for 95% confidence).

### Outputs
* Mean, variance, and the corrected standard error of the mean.

### The Batch Means Autocorrelation Correction Algorithm
In DES, consecutive queue waiting times are heavily correlated, which violates independent sampling assumptions. To correct this, we use the **Batch Means Method**:
1. Partition the raw time-series $\{X_1, X_2, \dots, X_N\}$ into $M$ large, contiguous batches of size $B$:
   $$\bar{Y}_j = \frac{1}{B} \sum_{i=(j-1)B + 1}^{jB} X_i \quad (j = 1, \dots, M)$$
2. Increase batch size $B$ until the correlation coefficient $\rho$ between adjacent batch means $\bar{Y}_j$ approaches zero:
   $$\rho_1 = \frac{\sum_{j=1}^{M-1} (\bar{Y}_j - \bar{\bar{Y}})(\bar{Y}_{j+1} - \bar{\bar{Y}})}{\sum_{j=1}^{M} (\bar{Y}_j - \bar{\bar{Y}})^2} < 0.05$$
3. Calculate the sample variance of these independent batch means:
   $$S^2_{\bar{Y}} = \frac{1}{M-1} \sum_{j=1}^{M} (\bar{Y}_j - \bar{\bar{Y}})^2$$
4. Construct the corrected $100(1-\alpha)\%$ Confidence Interval for the system mean:
   $$\text{CI} = \bar{\bar{Y}} \pm t_{M-1, 1-\alpha/2} \sqrt{\frac{S^2_{\bar{Y}}}{M}}$$

### Internal Data Structures
* **Time-Series Ring Buffer**: High-capacity double-precision ring buffers storing raw simulation sequences.
* **Autocorrelation Accumulator Matrix**: Flat buffers holding step-wise cross-products for real-time covariance calculations.
`
  },
  {
    id: "des-performance-uml",
    title: "9. Performance, UML & API Design",
    category: "System Design",
    shortDescription: "Work-stealing thread pools, GPGPU sorting, cache optimizations, class structures, and gRPC/REST APIs (Topics 44-50).",
    markdown: `# 9. Performance, UML & API Design

This section covers hardware-level performance engineering, multi-threading topologies, GPGPU acceleration, object class relationships, and public service API schemas.

---

## 9.1 Hardware Performance & Multi-Threading Topology (Topics 44 & 45)

### Responsibilities
Optimizes hardware resource usage across multi-socket CPUs, managing threads, cache coherence, and NUMA memory layout.

### Threading Architecture (Lock-Free Work-Stealing Pool)
NovaSim AI utilizes a custom **Work-Stealing Task Scheduler** (similar to Tokyo's scheduler or Intel TBB) designed for high concurrency:
* **The Worker Pool**: One dedicated system worker thread is pinned to each physical processor core using affinity masks (\`pthread_setaffinity_np\`), avoiding CPU scheduling context-switch overheads.
* **Local Run Queues**: Each thread maintains a lock-free double-ended run queue (Deque) of active simulation tasks (e.g. executing independent replications or regional sub-graphs).
* **The Stealing Protocol**: If a worker's queue becomes empty, it attempts to steal tasks from the back of neighboring workers' queues using atomic compare-and-swap (CAS) operations.

\`\`\`
+--------------------------------------------------------+
|                      WORKER POOL                       |
|                                                        |
|  [Worker Thread 0]      [Worker Thread 1]   (Steals)   |
|   +--------------+       +--------------+ <----------+ |
|   | Local Deque  |       | Local Deque  |            | |
|   | [Task][Task] |       |  (EMPTY)     |            | |
|   +--------------+       +--------------+            | |
|          |                      |                    | |
|          +--- (Steals Task) ----+--------------------+ |
+--------------------------------------------------------+
\`\`\`

### Cache Coherence (False Sharing Protection)
To protect L1/L2 caches, all core structures align to 64-byte boundaries:
\`\`\`cpp
struct alignas(64) WorkerState {
    std::atomic<uint64_t> processed_events; // Spans exactly one cache line
    char pad[56];                           // Prevents adjacent threads from dirtying cache
};
\`\`\`
This prevents "False Sharing" where multiple threads writing to adjacent variables force constant cache invalidation cycles across cores.

---

## 9.2 GPU Acceleration Strategy (Topic 46)

### Responsibilities
Accelerates massive FEL scheduling operations using massive GPGPU parallelism.

### GPU Parallel Heap-Sorting Algorithm
When active future events exceed $10^7$ blocks, standard CPU heaps bottleneck. NovaSim AI offloads event sorting to the GPU using **CUDA Warp-Sort Kernels**:
1. Dynamic events are packed into contiguous 64-bit key-value integers (Key = Scheduled Time, Value = Event Pointer).
2. The GPU executes a parallel **Radix Sort / Bitonic Merge Sort** pipeline:
   * Threads in a single warp (32 threads) perform warp-level cooperative register shuffles (\`__shfl_xor_sync\`), sorting local chunks in less than 2 nanoseconds.
   * Multi-block prefix-sum passes merge local chunks into a single, global sorted list.
3. The top $10^5$ sorted events are copied back to CPU shared memory to supply the active execution queues, while the remainder reside in GPU VRAM.

---

## 9.3 Memory Optimization & Data Structures (Topics 47 & 48)

### Responsibilities
Enforces custom memory management, avoiding allocations during active simulation steps, and utilizes optimized primitives.

### Memory Optimization Specifications
* **Zero Allocations During Runtime**: The simulation engine is **strictly forbidden** from calling \`malloc\` or \`new\` inside the tick loop. All memory requirements (Entities, Events, Queues) are pre-allocated inside aligned Arenas.
* **Flat Array Index Pointers**: Pointer references are stored as raw 32-bit offset indexes (\`uint32_t\`) rather than full 64-bit pointers. This halves the memory footprint of graph links, fitting twice as much topological data inside CPU L1/L2 caches.

### Data Structures Layout
* **Quaternary Min-Heap Array**: FEL container.
* **Lock-Free Ring Buffer (Single Producer, Single Consumer)**: For inter-thread telemetry streaming.
* **Adjacency Lists (Flat Array Compressed Sparse Row)**: Fast system graph representation.

---

## 9.4 UML Class Diagram Description (Topic 49)

### System Core Class Taxonomy
The system is built on a clear, clean class relationship structure:

* **DesEngine**: The central orchestrator.
  * *Composition*: Holds 1 \`FutureEventList\`, 1 \`StateRegister\`, 1 \`ResourceRegistry\`, and 1 \`TelemetryLogger\`.
* **FutureEventList**: Holds sorted \`ScheduledEvent\` structures.
* **DesEntity**: The moving objects.
  * *Attributes*: UUID, dynamic attributes, current state, active routing path.
* **DesResource**: Consists of token allocations, allocation queues, and preemptive stacks.
* **DesQueue**: Manages buffers, policy evaluation modules, and reneging timers.

\`\`\`
+------------------+         +-------------------+
|    DesEngine     |o------->|  FutureEventList  |
+------------------+         +-------------------+
| - clock: f64     |         | - heap: vector    |
| - status: Enum   |         +-------------------+
+------------------+                  o
        o                             | (holds)
        |                             v
        |                    +-------------------+
        |                    |  ScheduledEvent   |
        |                    +-------------------+
        |                    | - event_id: u64   |
        |                    | - time: f64       |
        |                    +-------------------+
        v
+------------------+
|   DesEntity      |
+------------------+
| - entity_id: u64 |
| - priority: u8   |
+------------------+
\`\`\`

---

## 9.5 Core Interface & API Specifications (Topic 50)

### gRPC Service Definition (\`novasim_des.proto\`)
Provides standardized endpoints for headless simulation orchestrations:

\`\`\`protobuf
syntax = "proto3";
package novasim.des;

service DesEngineService {
  rpc InitializeEngine (DesConfig) returns (EngineStatusResponse);
  rpc StartSimulation (StartRequest) returns (stream SimulationFrame);
  rpc CommandPause (CommandRequest) returns (EngineStatusResponse);
  rpc CommandResume (CommandRequest) returns (EngineStatusResponse);
  rpc GetHistoricalTelemetry (TelemetryRequest) returns (TelemetryResponse);
}

message DesConfig {
  string project_id = 1;
  double max_simulation_time = 2;
  double warmup_period = 3;
  uint32 replication_count = 4;
  uint64 base_seed = 5;
  bytes system_graph_json = 6;
}

message StartRequest {
  string project_id = 1;
  double time_scale_factor = 2; // Real-time throttling factor
}

message SimulationFrame {
  double current_clock = 1;
  uint64 active_entities_count = 2;
  repeated EntityState entities = 3;
  repeated ResourceState resources = 4;
}

message EntityState {
  uint64 entity_id = 1;
  string entity_type = 2;
  string current_node_id = 3;
}

message ResourceState {
  string resource_id = 1;
  uint32 total_capacity = 2;
  uint32 allocated_tokens = 3;
  double current_utilization = 4;
}

message CommandRequest {
  string project_id = 1;
}

message EngineStatusResponse {
  string status = 1; // "RUNNING", "PAUSED", "STOPPED", "FAULT"
  string message = 2;
}

message TelemetryRequest {
  string project_id = 1;
}

message TelemetryResponse {
  repeated double timestamps = 1;
  repeated double resource_utilization = 2;
  double mean_time_in_system = 3;
  double confidence_interval_halfwidth = 4;
}
\`\`\`
`
  }
];
