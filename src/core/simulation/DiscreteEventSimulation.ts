import {
  SimNode,
  SimConnection,
  SimulationLayout,
  SimEntity,
  SimEvent,
  ResourceState,
  SimulationStateSummary
} from "./types";

// Random probability services
export class RandomService {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  // Simple LCG random number generator for reproducible seed-based runs
  public nextDouble(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  public exponential(mean: number): number {
    return -Math.log(1.0 - this.nextDouble()) * mean;
  }

  public normal(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = this.nextDouble();
    while (v === 0) v = this.nextDouble();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0.01, num * stdDev + mean);
  }

  public sample(distribution: "constant" | "exponential" | "normal", mean: number): number {
    if (distribution === "exponential") {
      return this.exponential(mean);
    } else if (distribution === "normal") {
      return this.normal(mean, mean * 0.2); // stdDev is 20% of mean
    }
    return mean; // constant
  }
}

// Future Event List priority queue sorted chronologically
export class FutureEventList {
  private events: SimEvent[] = [];

  public get count(): number {
    return this.events.length;
  }

  public enqueue(event: SimEvent): void {
    // Binary search insertion to keep events sorted by time, then priority
    let low = 0;
    let high = this.events.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const existing = this.events[mid];

      if (existing.time < event.time) {
        low = mid + 1;
      } else if (existing.time > event.time) {
        high = mid;
      } else {
        // Equal times, sort by priority (lower priority number executes first)
        if (existing.priority <= event.priority) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
    }
    this.events.splice(low, 0, event);
  }

  public dequeue(): SimEvent {
    const ev = this.events.shift();
    if (!ev) {
      throw new Error("Future Event List is empty.");
    }
    return ev;
  }

  public peek(): SimEvent | null {
    return this.events.length > 0 ? this.events[0] : null;
  }

  public clear(): void {
    this.events = [];
  }

  public cancelEventsForEntity(entityId: string): number {
    const originalCount = this.events.length;
    this.events = this.events.filter((ev) => ev.entityId !== entityId);
    return originalCount - this.events.length;
  }

  public getEvents(): SimEvent[] {
    return [...this.events];
  }
}

// Discrete Event Simulation Orchestrator
export class DiscreteEventSimulation {
  public layout: SimulationLayout;
  public clockTime: number = 0;
  public stepCount: number = 0;
  public state: "Created" | "Running" | "Paused" | "Stopped" | "Completed" = "Created";

  public entities: SimEntity[] = [];
  public futureEvents: FutureEventList = new FutureEventList();
  public resources: Record<string, ResourceState> = {};
  public logs: string[] = [];

  private rng: RandomService;
  private seed: number;
  private entityCounter: number = 0;

  // Graph Adjacency List for routing
  private routes: Record<string, string[]> = {};

  constructor(layout: SimulationLayout, seed: number = 42) {
    this.layout = layout;
    this.seed = seed;
    this.rng = new RandomService(seed);
    this.initialize();
  }

  public initialize(): void {
    this.clockTime = 0;
    this.stepCount = 0;
    this.entities = [];
    this.futureEvents.clear();
    this.resources = {};
    this.logs = [];
    this.entityCounter = 0;
    this.state = "Created";

    // 1. Build routes dictionary
    this.routes = {};
    for (const node of this.layout.nodes) {
      this.routes[node.id] = [];
    }
    for (const conn of this.layout.connections) {
      if (this.routes[conn.sourceId]) {
        this.routes[conn.sourceId].push(conn.targetId);
      }
    }

    // 2. Initialize resources for Processors & Queues
    for (const node of this.layout.nodes) {
      if (node.type === "processor") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.capacity || 1,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0
        };
      } else if (node.type === "queue") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.capacity || 9999, // practically infinite queue
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0
        };
      }
    }

    // 3. Schedule initial arrivals for all Sources
    for (const node of this.layout.nodes) {
      if (node.type === "source") {
        const interval = node.properties.arrivalInterval || 10;
        const dist = node.properties.distribution || "exponential";
        const firstArrivalTime = this.rng.sample(dist, interval);
        
        this.scheduleEvent({
          id: `init_arrival_${node.id}_${Math.floor(Math.random() * 100000)}`,
          time: firstArrivalTime,
          type: "Arrival",
          nodeId: node.id,
          entityId: `entity_pending_${node.id}`,
          priority: 5
        });

        this.log(`Scheduled initial arrival for ${node.name} at T=${firstArrivalTime.toFixed(2)}s`);
      }
    }

    this.log("Simulation engine initialized successfully.");
  }

  public step(): boolean {
    const nextEvent = this.futureEvents.peek();
    if (!nextEvent) {
      this.state = "Completed";
      this.log(`No more events. Simulation completed at T=${this.clockTime.toFixed(2)}s`);
      return false;
    }

    // Advance clock to next event time
    const previousTime = this.clockTime;
    this.clockTime = nextEvent.time;
    this.stepCount++;

    // Dequeue event
    const event = this.futureEvents.dequeue();

    // Track utilization integration for resources
    const timeDelta = this.clockTime - previousTime;
    if (timeDelta > 0) {
      for (const resId in this.resources) {
        const res = this.resources[resId];
        if (res.occupiedCount > 0) {
          res.totalBusyTime += timeDelta * (res.occupiedCount / res.capacity);
          res.utilization = Math.min(1.0, res.totalBusyTime / this.clockTime);
        }
      }
    }

    // Process event based on type
    this.processEvent(event);

    return true;
  }

  private processEvent(event: SimEvent): void {
    const node = this.layout.nodes.find((n) => n.id === event.nodeId);
    if (!node) return;

    switch (event.type) {
      case "Arrival":
        this.handleArrival(event, node);
        break;
      case "ProcessStart":
        this.handleProcessStart(event, node);
        break;
      case "ProcessComplete":
        this.handleProcessComplete(event, node);
        break;
      case "QueueEnter":
        this.handleQueueEnter(event, node);
        break;
      case "QueueExit":
        this.handleQueueExit(event, node);
        break;
    }
  }

  private handleArrival(event: SimEvent, node: SimNode): void {
    // 1. Create the real entity
    this.entityCounter++;
    const entityColor = node.properties.color || "#6366f1";
    const entity: SimEntity = {
      id: `ENT_${this.entityCounter.toString().padStart(4, "0")}`,
      name: `Entity ${this.entityCounter}`,
      type: "Standard",
      color: entityColor,
      creationTime: this.clockTime,
      currentLocationId: node.id,
      status: "Arrived",
      routePath: [node.id]
    };
    this.entities.push(entity);

    this.log(`[T=${this.clockTime.toFixed(2)}s] Create ${entity.id} at ${node.name}`);

    // 2. Schedule next arrival from this source
    const interval = node.properties.arrivalInterval || 10;
    const dist = node.properties.distribution || "exponential";
    const nextInterval = this.rng.sample(dist, interval);
    this.scheduleEvent({
      id: `arrival_${node.id}_${this.entityCounter + 1}`,
      time: this.clockTime + nextInterval,
      type: "Arrival",
      nodeId: node.id,
      entityId: `entity_pending_${node.id}`,
      priority: 5
    });

    // 3. Route this entity to connected nodes
    this.routeEntity(entity, node.id);
  }

  private handleQueueEnter(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    entity.currentLocationId = node.id;
    entity.status = "Queued";
    entity.routePath.push(node.id);

    const resource = this.resources[node.id];
    if (resource) {
      resource.waitingEntityIds.push(entity.id);
      resource.queueLength = resource.waitingEntityIds.length;
    }

    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} entered ${node.name} (Queue size: ${resource?.queueLength || 0})`);

    // Check if downstream processors are connected and have free capacity
    this.tryPullFromQueue(node.id);
  }

  private handleQueueExit(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    const resource = this.resources[node.id];
    if (resource) {
      resource.waitingEntityIds = resource.waitingEntityIds.filter((id) => id !== entity.id);
      resource.queueLength = resource.waitingEntityIds.length;
    }

    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} exited ${node.name}`);
  }

  private handleProcessStart(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    entity.currentLocationId = node.id;
    entity.status = "InService";
    entity.routePath.push(node.id);

    const resource = this.resources[node.id];
    if (resource) {
      resource.occupiedCount++;
      resource.activeEntityIds.push(entity.id);
    }

    const procTime = node.properties.processingTime || 8;
    const dist = node.properties.distribution || "constant";
    const serviceDuration = this.rng.sample(dist, procTime);

    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} began processing at ${node.name} for ${serviceDuration.toFixed(2)}s`);

    // Schedule process completion
    this.scheduleEvent({
      id: `proc_comp_${node.id}_${entity.id}`,
      time: this.clockTime + serviceDuration,
      type: "ProcessComplete",
      nodeId: node.id,
      entityId: entity.id,
      priority: 3
    });
  }

  private handleProcessComplete(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    const resource = this.resources[node.id];
    if (resource) {
      resource.occupiedCount = Math.max(0, resource.occupiedCount - 1);
      resource.activeEntityIds = resource.activeEntityIds.filter((id) => id !== entity.id);
    }

    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} completed processing at ${node.name}`);

    // Trigger queue pulls if processors have available slots
    const inboundQueues = this.layout.connections
      .filter((c) => c.targetId === node.id)
      .map((c) => c.sourceId);

    for (const qId of inboundQueues) {
      this.tryPullFromQueue(qId);
    }

    // Route entity to downstream
    this.routeEntity(entity, node.id);
  }

  private routeEntity(entity: SimEntity, currentNodeId: string): void {
    const outputs = this.routes[currentNodeId] || [];
    if (outputs.length === 0) {
      // Reached a dead end or terminal
      const node = this.layout.nodes.find((n) => n.id === currentNodeId);
      if (node && node.type === "sink") {
        entity.status = "Completed";
        this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} reached SINK ${node.name} and completed workflow.`);
      }
      return;
    }

    const currentNode = this.layout.nodes.find((n) => n.id === currentNodeId);
    let targetNodeId = outputs[0];

    if (currentNode && currentNode.type === "router" && outputs.length > 1) {
      // Implement probability-based routing
      const prob = currentNode.properties.routeProbability ?? 0.5;
      const roll = this.rng.nextDouble();
      targetNodeId = roll <= prob ? outputs[0] : outputs[1];
    } else if (outputs.length > 1) {
      // Equal distribution fallback if multiple outputs and not a router
      const idx = Math.floor(this.rng.nextDouble() * outputs.length);
      targetNodeId = outputs[idx];
    }

    const targetNode = this.layout.nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return;

    if (targetNode.type === "queue") {
      this.scheduleEvent({
        id: `queue_enter_${targetNode.id}_${entity.id}`,
        time: this.clockTime,
        type: "QueueEnter",
        nodeId: targetNode.id,
        entityId: entity.id,
        priority: 4
      });
    } else if (targetNode.type === "processor") {
      const resource = this.resources[targetNode.id];
      if (resource && resource.occupiedCount < resource.capacity) {
        // Direct processing
        this.scheduleEvent({
          id: `proc_start_${targetNode.id}_${entity.id}`,
          time: this.clockTime,
          type: "ProcessStart",
          nodeId: targetNode.id,
          entityId: entity.id,
          priority: 4
        });
      } else {
        // Downstream busy, route to a queue attached to it or log buffer block
        this.log(`[BLOCK] ${entity.id} blocked: ${targetNode.name} has no available capacity!`);
      }
    } else if (targetNode.type === "sink") {
      entity.currentLocationId = targetNode.id;
      entity.status = "Completed";
      entity.routePath.push(targetNode.id);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} completed flow at ${targetNode.name}`);
    } else {
      // Normal transit, recurse routing
      entity.routePath.push(targetNode.id);
      this.routeEntity(entity, targetNode.id);
    }
  }

  private tryPullFromQueue(queueId: string): void {
    const queueNode = this.layout.nodes.find((n) => n.id === queueId);
    if (!queueNode) return;

    const queueRes = this.resources[queueId];
    if (!queueRes || queueRes.waitingEntityIds.length === 0) return;

    // Find downstream processors
    const downstreamIds = this.routes[queueId] || [];
    for (const pId of downstreamIds) {
      const pNode = this.layout.nodes.find((n) => n.id === pId);
      if (pNode && pNode.type === "processor") {
        const procRes = this.resources[pId];
        if (procRes && procRes.occupiedCount < procRes.capacity) {
          // Dequeue entity from waiting queue
          const nextEntityId = queueRes.waitingEntityIds[0];
          
          this.scheduleEvent({
            id: `queue_exit_${queueId}_${nextEntityId}`,
            time: this.clockTime,
            type: "QueueExit",
            nodeId: queueId,
            entityId: nextEntityId,
            priority: 2
          });

          this.scheduleEvent({
            id: `proc_start_${pId}_${nextEntityId}`,
            time: this.clockTime,
            type: "ProcessStart",
            nodeId: pId,
            entityId: nextEntityId,
            priority: 4
          });

          // Break to evaluate next items recursively or sequentially
          break;
        }
      }
    }
  }

  private scheduleEvent(event: SimEvent): void {
    this.futureEvents.enqueue(event);
  }

  private log(message: string): void {
    this.logs.unshift(message);
    if (this.logs.length > 200) {
      this.logs.pop();
    }
  }

  public getSummary(): SimulationStateSummary {
    return {
      clockTime: this.clockTime,
      state: this.state,
      stepCount: this.stepCount,
      entities: [...this.entities],
      resources: JSON.parse(JSON.stringify(this.resources)),
      recentLogs: [...this.logs]
    };
  }
}
