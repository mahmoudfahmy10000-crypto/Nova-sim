import {
  SimNode,
  SimConnection,
  SimulationLayout,
  SimEntity,
  SimEvent,
  ResourceState,
  ResourceUnitState,
  SimulationStateSummary,
  EntityHistoryItem
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

  public getNormalizedType(type: string): string {
    switch (type) {
      case "source":
        return "source";
      case "sink":
        return "sink";
      case "queue":
      case "buffer":
      case "storage":
      case "rack":
      case "pallet":
      case "container":
        return "queue";
      case "processor":
      case "delay":
      case "machine":
      case "custom object":
        return "processor";
      case "combiner":
      case "batch":
        return "combiner";
      case "separator":
      case "split":
        return "separator";
      case "conveyor":
      case "path":
        return "conveyor";
      case "resource":
      case "operator":
      case "worker":
        return "resource";
      case "transporter":
      case "agv":
      case "forklift":
      case "crane":
      case "elevator":
      case "robot":
        return "transporter";
      case "router":
      case "sensor":
      case "decision":
      case "merge":
      case "transfer":
      case "network node":
        return "router";
      default:
        return "processor";
    }
  }
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
  private eventCounter: number = 0;

  // Graph Adjacency List for routing
  private routes: Record<string, string[]> = {};

  // Analytics and KPI variables (Phase 11)
  private statsTotalEntered: Record<string, number> = {};
  private statsTotalCompleted: Record<string, number> = {};
  private statsProcessingTimeIntegral: Record<string, number> = {};
  private statsWaitingTimeIntegral: Record<string, number> = {};
  private statsMaxQueueLength: Record<string, number> = {};
  private statsQueueLengthTimeIntegral: Record<string, number> = {};
  private statsLastQueueChangeTime: Record<string, number> = {};
  private statsTimeSeries: any[] = [];
  private statsLastTimeSeriesTime: number = -1;

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
    this.eventCounter = 0;
    this.rng = new RandomService(this.seed);
    this.state = "Created";

    // Initialize statistics variables
    this.statsTotalEntered = {};
    this.statsTotalCompleted = {};
    this.statsProcessingTimeIntegral = {};
    this.statsWaitingTimeIntegral = {};
    this.statsMaxQueueLength = {};
    this.statsQueueLengthTimeIntegral = {};
    this.statsLastQueueChangeTime = {};
    this.statsTimeSeries = [];
    this.statsLastTimeSeriesTime = -1;

    for (const node of this.layout.nodes) {
      this.statsTotalEntered[node.id] = 0;
      this.statsTotalCompleted[node.id] = 0;
      this.statsProcessingTimeIntegral[node.id] = 0;
      this.statsWaitingTimeIntegral[node.id] = 0;
      this.statsMaxQueueLength[node.id] = 0;
      this.statsQueueLengthTimeIntegral[node.id] = 0;
      this.statsLastQueueChangeTime[node.id] = 0;
    }

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

    // 2. Initialize resources for Processors, Queues, Conveyors, Resources, Transporters, Separators, and Combiners
    for (const node of this.layout.nodes) {
      const normType = this.getNormalizedType(node.type);
      if (normType === "processor") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.capacity || 1,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          resourceType: "Machine"
        };
      } else if (normType === "queue") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.capacity || 9999, // practically infinite queue
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          resourceType: "Space"
        };
      } else if (normType === "conveyor") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.capacity || 10,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          resourceType: "Machine"
        };
      } else if (normType === "resource") {
        const capacity = node.properties.quantity || 1;
        const resType = node.properties.resourceType || "Worker";
        
        // Custom resource scheduling options (defaults in seconds)
        const shiftEnabled = node.properties.shiftEnabled ?? true;
        const shiftStart = node.properties.shiftStart ?? 0;
        const shiftEnd = node.properties.shiftEnd ?? 400;
        const shiftCycle = node.properties.shiftCycle ?? 500;

        const breakEnabled = node.properties.breakEnabled ?? false;
        const breakStart = node.properties.breakStart ?? 150;
        const breakEnd = node.properties.breakEnd ?? 185;
        const breakCycle = node.properties.breakCycle ?? 500;

        const failureEnabled = node.properties.failureEnabled ?? false;
        const failureMTBF = node.properties.failureMTBF ?? 200;
        const failureMTTR = node.properties.failureMTTR ?? 40;

        const maintenanceEnabled = node.properties.maintenanceEnabled ?? false;
        const maintenanceInterval = node.properties.maintenanceInterval ?? 300;
        const maintenanceDuration = node.properties.maintenanceDuration ?? 30;

        // Initialize individual unit states
        const units: ResourceUnitState[] = [];
        for (let i = 1; i <= capacity; i++) {
          units.push({
            id: `UNIT_${node.id}_${i}`,
            name: `${resType} ${i}`,
            state: "Idle",
            assignedEntityId: null,
            timeInStates: {
              Idle: 0,
              Busy: 0,
              Breakdown: 0,
              OnBreak: 0,
              OffShift: 0,
              UnderMaintenance: 0
            },
            lastStateChangeTime: 0,
            nextFailureTime: failureEnabled ? (50 + this.rng.nextDouble() * failureMTBF) : 9999999, // staggered first failure
            nextMaintenanceTime: maintenanceEnabled ? maintenanceInterval : 9999999,
            maintenanceEndTime: 0,
            repairEndTime: 0
          });
        }

        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          
          resourceType: resType,
          units,
          
          shiftEnabled,
          shiftStart,
          shiftEnd,
          shiftCycle,
          
          breakEnabled,
          breakStart,
          breakEnd,
          breakCycle,
          
          failureEnabled,
          failureMTBF,
          failureMTTR,
          
          maintenanceEnabled,
          maintenanceInterval,
          maintenanceDuration
        };
      } else if (normType === "transporter") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: node.properties.transporterCapacity || 5,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          resourceType: "Machine"
        };
      } else if (normType === "separator" || normType === "combiner") {
        this.resources[node.id] = {
          nodeId: node.id,
          name: node.name,
          capacity: 1,
          occupiedCount: 0,
          queueLength: 0,
          activeEntityIds: [],
          waitingEntityIds: [],
          utilization: 0,
          totalBusyTime: 0,
          resourceType: "Machine"
        };
      }
    }

    // 3. Schedule initial arrivals for all Sources
    for (const node of this.layout.nodes) {
      if (this.getNormalizedType(node.type) === "source") {
        const interval = node.properties.arrivalInterval || 10;
        const dist = node.properties.distribution || "exponential";
        const firstArrivalTime = this.rng.sample(dist, interval);
        
        this.eventCounter++;
        this.scheduleEvent({
          id: `init_arrival_${node.id}_${this.eventCounter}`,
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
      // 1. Update queue-length time integrals for Phase 11
      for (const node of this.layout.nodes) {
        const qLen = this.resources[node.id]?.queueLength || 0;
        this.statsQueueLengthTimeIntegral[node.id] = (this.statsQueueLengthTimeIntegral[node.id] || 0) + (qLen * timeDelta);
        if (qLen > (this.statsMaxQueueLength[node.id] || 0)) {
          this.statsMaxQueueLength[node.id] = qLen;
        }
      }

      for (const resId in this.resources) {
        const res = this.resources[resId];
        if (res.units && res.units.length > 0) {
          for (const unit of res.units) {
            unit.timeInStates[unit.state] = (unit.timeInStates[unit.state] || 0) + timeDelta;
          }
          
          let totalBusyOfUnits = 0;
          for (const unit of res.units) {
            totalBusyOfUnits += unit.timeInStates["Busy"];
          }
          const maxTotalTime = this.clockTime * res.units.length;
          res.utilization = maxTotalTime > 0 ? (totalBusyOfUnits / maxTotalTime) : 0;
          res.occupiedCount = res.units.filter(u => u.state === "Busy").length;
        } else {
          if (res.occupiedCount > 0) {
            res.totalBusyTime += timeDelta * (res.occupiedCount / res.capacity);
            res.utilization = Math.min(1.0, res.totalBusyTime / this.clockTime);
          }
        }
      }
    }

    // Run transition checks for resources at the new clockTime
    this.updateResourceUnitStates();

    // Process event based on type
    this.processEvent(event);

    // Record timeseries data point for high-fidelity charting
    this.recordTimeSeriesPoint();

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

  private updateResourceUnitStates(): void {
    const time = this.clockTime;
    
    for (const resId in this.resources) {
      const res = this.resources[resId];
      if (!res.units || res.units.length === 0) continue;
      
      const shiftCycle = res.shiftCycle || 500;
      const breakCycle = res.breakCycle || 500;
      
      for (const unit of res.units) {
        const previousState = unit.state;
        let newState: "Idle" | "Busy" | "Breakdown" | "OnBreak" | "OffShift" | "UnderMaintenance" = "Idle";
        
        // 1. Check Shift schedule
        let isOffShift = false;
        if (res.shiftEnabled) {
          const cycleTime = time % shiftCycle;
          const start = res.shiftStart ?? 0;
          const end = res.shiftEnd ?? 400;
          if (cycleTime < start || cycleTime > end) {
            isOffShift = true;
          }
        }
        
        // 2. Check Break schedule
        let isOnBreak = false;
        if (!isOffShift && res.breakEnabled) {
          const cycleTime = time % breakCycle;
          const start = res.breakStart ?? 150;
          const end = res.breakEnd ?? 185;
          if (cycleTime >= start && cycleTime <= end) {
            isOnBreak = true;
          }
        }

        // 3. Check maintenance
        let isMaintenance = false;
        if (!isOffShift && !isOnBreak && res.maintenanceEnabled) {
          // Check if currently in maintenance
          if (unit.state === "UnderMaintenance") {
            if (time < unit.maintenanceEndTime) {
              isMaintenance = true;
            } else {
              // Maintenance finished! Schedule next maintenance
              unit.nextMaintenanceTime = time + (res.maintenanceInterval ?? 300);
              this.log(`[RESOURCE] Maintenance complete for ${unit.name} in pool ${res.name}.`);
            }
          } else if (time >= unit.nextMaintenanceTime) {
            // Trigger maintenance
            unit.maintenanceEndTime = time + (res.maintenanceDuration ?? 30);
            isMaintenance = true;
            this.log(`[RESOURCE] ${unit.name} in pool ${res.name} entered scheduled maintenance for ${(res.maintenanceDuration ?? 30)}s.`);
          }
        }

        // 4. Check failure / breakdown
        let isFailed = false;
        if (!isOffShift && !isOnBreak && !isMaintenance && res.failureEnabled) {
          // Check if currently broken down
          if (unit.state === "Breakdown") {
            if (time < unit.repairEndTime) {
              isFailed = true;
            } else {
              // Repaired! Schedule next failure
              unit.nextFailureTime = time + (this.rng.sample("exponential", res.failureMTBF ?? 200));
              this.log(`[RESOURCE] ${unit.name} in pool ${res.name} is repaired and back online.`);
            }
          } else if (time >= unit.nextFailureTime) {
            // Trigger breakdown
            unit.repairEndTime = time + (this.rng.sample("exponential", res.failureMTTR ?? 40));
            isFailed = true;
            this.log(`[RESOURCE] BREAKDOWN! ${unit.name} in pool ${res.name} failed. MTTR: ${(res.failureMTTR ?? 40)}s.`);
          }
        }

        // Apply state rules
        if (isOffShift) {
          newState = "OffShift";
        } else if (isOnBreak) {
          newState = "OnBreak";
        } else if (isMaintenance) {
          newState = "UnderMaintenance";
        } else if (isFailed) {
          newState = "Breakdown";
        } else if (unit.assignedEntityId !== null) {
          newState = "Busy";
        } else {
          newState = "Idle";
        }

        // Handle transition logic
        if (newState !== previousState) {
          // If we transitioned to a non-available state while we were Busy, we must interrupt the task!
          if (previousState === "Busy" && newState !== "Busy") {
            const entityId = unit.assignedEntityId;
            if (entityId) {
              this.log(`[RESOURCE] Interrupted ${entityId} on ${unit.name} due to state transition: ${newState}`);
              
              // We find the process completion event for this entity and cancel it!
              this.futureEvents.cancelEventsForEntity(entityId);
              
              // Mark the entity as queued again, or suspend it so it can resume
              const entity = this.entities.find(e => e.id === entityId);
              if (entity) {
                entity.status = "Queued";
                this.addHistoryLog(entity, res.nodeId, "Queued", `Suspended due to resource interruption (${newState} on ${unit.name})`);
                
                // Keep the current node ID and put it back in processor waiting queue
                const procNode = this.layout.nodes.find(n => n.id === entity.currentLocationId);
                if (procNode) {
                  const procRes = this.resources[procNode.id];
                  if (procRes && !procRes.waitingEntityIds.includes(entityId)) {
                    procRes.waitingEntityIds.unshift(entityId); // Put at front of wait list to resume first
                    procRes.queueLength = procRes.waitingEntityIds.length;
                  }
                }
              }
              
              // Disassociate unit from entity
              unit.assignedEntityId = null;
            }
          }

          // If we transitioned BACK to Idle (available) from an offline state, try to trigger pull
          const isOffline = (state: string) => ["OffShift", "OnBreak", "UnderMaintenance", "Breakdown"].includes(state);
          if (isOffline(previousState) && !isOffline(newState) && newState === "Idle") {
            for (const qNode of this.layout.nodes) {
              if (this.getNormalizedType(qNode.type) === "queue") {
                this.tryPullFromQueue(qNode.id);
              }
            }
          }

          unit.state = newState;
          unit.lastStateChangeTime = time;
        }
      }
    }
  }

  private getConnectedResourceNodes(nodeId: string): SimNode[] {
    const connectedNodeIds = this.layout.connections
      .filter((c) => c.sourceId === nodeId || c.targetId === nodeId)
      .map((c) => (c.sourceId === nodeId ? c.targetId : c.sourceId));

    return this.layout.nodes.filter(
      (n) => this.getNormalizedType(n.type) === "resource" && connectedNodeIds.includes(n.id)
    );
  }

  private areResourcesAvailable(node: SimNode): boolean {
    const connectedResources = this.getConnectedResourceNodes(node.id);
    for (const resNode of connectedResources) {
      const resState = this.resources[resNode.id];
      if (resState) {
        if (resState.units && resState.units.length > 0) {
          const availableUnit = resState.units.find(u => u.state === "Idle");
          if (!availableUnit) {
            return false;
          }
        } else {
          if (resState.occupiedCount >= resState.capacity) {
            return false;
          }
        }
      }
    }
    return true;
  }

  private allocateResources(node: SimNode, entityId: string): void {
    const connectedResources = this.getConnectedResourceNodes(node.id);
    for (const resNode of connectedResources) {
      const resState = this.resources[resNode.id];
      if (resState) {
        if (resState.units && resState.units.length > 0) {
          const availableUnit = resState.units.find(u => u.state === "Idle");
          if (availableUnit) {
            availableUnit.state = "Busy";
            availableUnit.assignedEntityId = entityId;
            availableUnit.lastStateChangeTime = this.clockTime;
            resState.occupiedCount = resState.units.filter(u => u.state === "Busy").length;
            resState.activeEntityIds.push(entityId);
            this.log(`[RESOURCE] Allocated unit ${availableUnit.name} of ${resNode.name} to ${entityId}`);
          }
        } else {
          resState.occupiedCount++;
          resState.activeEntityIds.push(entityId);
          this.log(`[RESOURCE] Allocated 1 unit of ${resNode.name} to ${entityId}`);
        }
      }
    }
  }

  private releaseResources(node: SimNode, entityId: string): void {
    const connectedResources = this.getConnectedResourceNodes(node.id);
    for (const resNode of connectedResources) {
      const resState = this.resources[resNode.id];
      if (resState) {
        if (resState.units && resState.units.length > 0) {
          const busyUnit = resState.units.find(u => u.assignedEntityId === entityId);
          if (busyUnit) {
            busyUnit.state = "Idle";
            busyUnit.assignedEntityId = null;
            busyUnit.lastStateChangeTime = this.clockTime;
            resState.occupiedCount = resState.units.filter(u => u.state === "Busy").length;
            resState.activeEntityIds = resState.activeEntityIds.filter(id => id !== entityId);
            this.log(`[RESOURCE] Released unit ${busyUnit.name} of ${resNode.name} from ${entityId}`);
          }
        } else {
          resState.occupiedCount = Math.max(0, resState.occupiedCount - 1);
          resState.activeEntityIds = resState.activeEntityIds.filter(id => id !== entityId);
          this.log(`[RESOURCE] Released 1 unit of ${resNode.name} from ${entityId}`);
        }
      }
    }
    
    // Check all queues to see if they can now pull entities since resources are freed!
    for (const qNode of this.layout.nodes) {
      if (this.getNormalizedType(qNode.type) === "queue") {
        this.tryPullFromQueue(qNode.id);
      }
    }
  }

  private addHistoryLog(entity: SimEntity, nodeId: string, status: string, description: string): void {
    const node = this.layout.nodes.find(n => n.id === nodeId);
    const nodeName = node ? node.name : "Unknown Location";
    const historyItem: EntityHistoryItem = {
      time: this.clockTime,
      nodeId,
      nodeName,
      status,
      description
    };
    if (!entity.history) {
      entity.history = [];
    }
    entity.history.push(historyItem);
  }

  public cloneEntity(entity: SimEntity, suffix: string = "Clone"): SimEntity {
    this.entityCounter++;
    const clonedId = `ENT_CLONE_${this.entityCounter.toString().padStart(4, "0")}`;
    const cloned: SimEntity = {
      id: clonedId,
      name: `${entity.name} (${suffix})`,
      type: entity.type,
      color: entity.color,
      creationTime: this.clockTime,
      currentLocationId: entity.currentLocationId,
      status: entity.status,
      routePath: [...entity.routePath],
      priority: entity.priority,
      labels: [...entity.labels, "cloned"],
      attributes: { ...entity.attributes, cloneTimestamp: this.clockTime },
      history: [],
      parentEntityId: entity.id
    };
    this.addHistoryLog(cloned, entity.currentLocationId, entity.status, `Cloned from parent ${entity.id}`);
    this.entities.push(cloned);
    return cloned;
  }

  private handleArrival(event: SimEvent, node: SimNode): void {
    // 1. Create the real entity
    this.entityCounter++;
    const roll = this.rng.nextDouble();
    let type = "Standard";
    let color = node.properties.color || "#3B82F6";
    let priority = 1;
    let labels = ["standard"];
    let attributes: Record<string, any> = {
      weight: Math.round(5 + this.rng.nextDouble() * 15),
      speedGrade: "normal",
      sourceNode: node.name
    };

    if (roll < 0.15) {
      type = "VIP";
      color = "#F59E0B"; // Amber Gold
      priority = 3;
      labels = ["vip", "high-priority"];
      attributes = {
        weight: Math.round(10 + this.rng.nextDouble() * 30),
        speedGrade: "premium",
        customerTier: "Platinum",
        sourceNode: node.name
      };
    } else if (roll < 0.30) {
      type = "Express";
      color = "#EF4444"; // Red
      priority = 2;
      labels = ["express", "urgent"];
      attributes = {
        weight: Math.round(3 + this.rng.nextDouble() * 10),
        speedGrade: "fast",
        handlingNotes: "Fragile",
        sourceNode: node.name
      };
    } else if (roll < 0.45) {
      type = "Heavy";
      color = "#8B5CF6"; // Purple
      priority = 1;
      labels = ["heavy", "bulk"];
      attributes = {
        weight: Math.round(120 + this.rng.nextDouble() * 180),
        speedGrade: "slow",
        oversized: true,
        sourceNode: node.name
      };
    }

    const entity: SimEntity = {
      id: `ENT_${this.entityCounter.toString().padStart(4, "0")}`,
      name: `${type} ${this.entityCounter}`,
      type,
      color,
      creationTime: this.clockTime,
      currentLocationId: node.id,
      status: "Arrived",
      routePath: [node.id],
      priority,
      labels,
      attributes,
      history: []
    };
    
    this.addHistoryLog(entity, node.id, "Arrived", `Created at source node: ${node.name}`);
    this.entities.push(entity);

    this.log(`[T=${this.clockTime.toFixed(2)}s] Created entity ${entity.id} (${entity.type}) at ${node.name}`);

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

    this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
    entity.attributes.queueEnterTime = this.clockTime;

    entity.currentLocationId = node.id;
    entity.status = "Queued";
    entity.routePath.push(node.id);

    const resource = this.resources[node.id];
    if (resource) {
      resource.waitingEntityIds.push(entity.id);
      
      // PRIORITY QUEUE SORTING (higher priority goes to the front of the queue)
      resource.waitingEntityIds.sort((a, b) => {
        const entA = this.entities.find(e => e.id === a);
        const entB = this.entities.find(e => e.id === b);
        const prioA = entA ? entA.priority : 1;
        const prioB = entB ? entB.priority : 1;
        return prioB - prioA;
      });

      resource.queueLength = resource.waitingEntityIds.length;
    }

    this.addHistoryLog(entity, node.id, "Queued", `Entered buffer queue ${node.name}. Position: ${resource?.waitingEntityIds.indexOf(entity.id) !== -1 ? resource!.waitingEntityIds.indexOf(entity.id) + 1 : 1}`);
    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} (Prio: ${entity.priority}) entered ${node.name} (Queue size: ${resource?.queueLength || 0})`);

    // Check if downstream processors/conveyors are connected and have free capacity
    this.tryPullFromQueue(node.id);
  }

  private handleQueueExit(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    if (entity.attributes.queueEnterTime !== undefined) {
      const wait = this.clockTime - entity.attributes.queueEnterTime;
      entity.attributes.totalWaitingTime = (entity.attributes.totalWaitingTime || 0) + wait;
      entity.attributes.queueEnterTime = undefined;
      this.statsWaitingTimeIntegral[node.id] = (this.statsWaitingTimeIntegral[node.id] || 0) + wait;
    }
    this.statsTotalCompleted[node.id] = (this.statsTotalCompleted[node.id] || 0) + 1;

    const resource = this.resources[node.id];
    if (resource) {
      resource.waitingEntityIds = resource.waitingEntityIds.filter((id) => id !== entity.id);
      resource.queueLength = resource.waitingEntityIds.length;
    }

    this.addHistoryLog(entity, node.id, "InService", `Exited buffer queue ${node.name}`);
    this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} exited ${node.name}`);
  }

  private handleProcessStart(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    const normType = this.getNormalizedType(node.type);
    if (normType === "processor") {
      // Processor-specific resource check
      if (!this.areResourcesAvailable(node)) {
        const procRes = this.resources[node.id];
        if (procRes && !procRes.waitingEntityIds.includes(entity.id)) {
          procRes.waitingEntityIds.push(entity.id);
          procRes.queueLength = procRes.waitingEntityIds.length;
        }
        this.addHistoryLog(entity, node.id, "Queued", `Waiting for resource dependencies at processor ${node.name}`);
        this.log(`[BLOCK] ${entity.id} is waiting for resources at ${node.name}`);
        return;
      }

      this.allocateResources(node, entity.id);

      this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
      if (entity.attributes.queueEnterTime !== undefined) {
        const wait = this.clockTime - entity.attributes.queueEnterTime;
        entity.attributes.totalWaitingTime = (entity.attributes.totalWaitingTime || 0) + wait;
        entity.attributes.queueEnterTime = undefined;
        const lastLocId = entity.routePath[entity.routePath.length - 1];
        if (lastLocId) {
          this.statsWaitingTimeIntegral[lastLocId] = (this.statsWaitingTimeIntegral[lastLocId] || 0) + wait;
          this.statsTotalCompleted[lastLocId] = (this.statsTotalCompleted[lastLocId] || 0) + 1;
        }
      }
      entity.attributes.processStartTime = this.clockTime;

      entity.currentLocationId = node.id;
      entity.status = "InService";
      entity.routePath.push(node.id);

      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount++;
        resource.activeEntityIds.push(entity.id);
        resource.waitingEntityIds = resource.waitingEntityIds.filter(id => id !== entity.id);
        resource.queueLength = resource.waitingEntityIds.length;
      }

      const procTime = node.properties.processingTime || 8;
      const dist = node.properties.distribution || "constant";
      const serviceDuration = this.rng.sample(dist, procTime);

      this.addHistoryLog(entity, node.id, "InService", `Began processing for ${serviceDuration.toFixed(2)}s`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} began processing at ${node.name} for ${serviceDuration.toFixed(2)}s`);

      this.scheduleEvent({
        id: `proc_comp_${node.id}_${entity.id}`,
        time: this.clockTime + serviceDuration,
        type: "ProcessComplete",
        nodeId: node.id,
        entityId: entity.id,
        priority: 3
      });

    } else if (normType === "conveyor") {
      this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
      if (entity.attributes.queueEnterTime !== undefined) {
        const wait = this.clockTime - entity.attributes.queueEnterTime;
        entity.attributes.totalWaitingTime = (entity.attributes.totalWaitingTime || 0) + wait;
        entity.attributes.queueEnterTime = undefined;
        const lastLocId = entity.routePath[entity.routePath.length - 1];
        if (lastLocId) {
          this.statsWaitingTimeIntegral[lastLocId] = (this.statsWaitingTimeIntegral[lastLocId] || 0) + wait;
          this.statsTotalCompleted[lastLocId] = (this.statsTotalCompleted[lastLocId] || 0) + 1;
        }
      }
      entity.attributes.processStartTime = this.clockTime;

      entity.currentLocationId = node.id;
      entity.status = "InService";
      entity.routePath.push(node.id);

      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount++;
        resource.activeEntityIds.push(entity.id);
      }

      // Conveyor speed & length determines transit duration
      const speed = node.properties.conveyorSpeed || 1.0;
      const length = node.properties.conveyorLength || 10;
      const duration = length / speed;

      this.addHistoryLog(entity, node.id, "InService", `Entered conveyor belt, transit duration: ${duration.toFixed(2)}s`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} entered Conveyor belt ${node.name} (transit: ${duration.toFixed(2)}s)`);

      this.scheduleEvent({
        id: `conv_comp_${node.id}_${entity.id}`,
        time: this.clockTime + duration,
        type: "ProcessComplete",
        nodeId: node.id,
        entityId: entity.id,
        priority: 3
      });

    } else if (normType === "transporter") {
      this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
      if (entity.attributes.queueEnterTime !== undefined) {
        const wait = this.clockTime - entity.attributes.queueEnterTime;
        entity.attributes.totalWaitingTime = (entity.attributes.totalWaitingTime || 0) + wait;
        entity.attributes.queueEnterTime = undefined;
        const lastLocId = entity.routePath[entity.routePath.length - 1];
        if (lastLocId) {
          this.statsWaitingTimeIntegral[lastLocId] = (this.statsWaitingTimeIntegral[lastLocId] || 0) + wait;
          this.statsTotalCompleted[lastLocId] = (this.statsTotalCompleted[lastLocId] || 0) + 1;
        }
      }
      entity.attributes.processStartTime = this.clockTime;

      entity.currentLocationId = node.id;
      entity.status = "InService";
      entity.routePath.push(node.id);

      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount++;
        resource.activeEntityIds.push(entity.id);
      }

      const speed = node.properties.transporterSpeed || 2.0;
      const duration = 10 / speed; // 10 meters default travel distance

      this.addHistoryLog(entity, node.id, "InService", `Loaded onto transporter, travel duration: ${duration.toFixed(2)}s`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} loaded onto Transporter ${node.name} (transit: ${duration.toFixed(2)}s)`);

      this.scheduleEvent({
        id: `trans_comp_${node.id}_${entity.id}`,
        time: this.clockTime + duration,
        type: "ProcessComplete",
        nodeId: node.id,
        entityId: entity.id,
        priority: 3
      });
    } else {
      this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
      entity.attributes.processStartTime = this.clockTime;

      // General fallback
      entity.currentLocationId = node.id;
      entity.status = "InService";
      entity.routePath.push(node.id);

      this.addHistoryLog(entity, node.id, "InService", `Began general step transit`);
      this.scheduleEvent({
        id: `comp_${node.id}_${entity.id}`,
        time: this.clockTime + 1,
        type: "ProcessComplete",
        nodeId: node.id,
        entityId: entity.id,
        priority: 3
      });
    }
  }

  private handleProcessComplete(event: SimEvent, node: SimNode): void {
    const entity = this.entities.find((e) => e.id === event.entityId);
    if (!entity) return;

    if (entity.attributes.processStartTime !== undefined) {
      const proc = this.clockTime - entity.attributes.processStartTime;
      entity.attributes.totalProcessingTime = (entity.attributes.totalProcessingTime || 0) + proc;
      entity.attributes.processStartTime = undefined;
      this.statsProcessingTimeIntegral[node.id] = (this.statsProcessingTimeIntegral[node.id] || 0) + proc;
    }
    this.statsTotalCompleted[node.id] = (this.statsTotalCompleted[node.id] || 0) + 1;

    const normType = this.getNormalizedType(node.type);
    if (normType === "processor") {
      this.releaseResources(node, entity.id);

      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount = Math.max(0, resource.occupiedCount - 1);
        resource.activeEntityIds = resource.activeEntityIds.filter((id) => id !== entity.id);
      }

      this.addHistoryLog(entity, node.id, "Arrived", `Completed processing at machine ${node.name}`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} completed processing at ${node.name}`);

      // Pull from inbound queues
      const inboundQueues = this.layout.connections
        .filter((c) => c.targetId === node.id)
        .map((c) => c.sourceId);

      for (const qId of inboundQueues) {
        this.tryPullFromQueue(qId);
      }

      this.routeEntity(entity, node.id);

    } else if (normType === "conveyor") {
      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount = Math.max(0, resource.occupiedCount - 1);
        resource.activeEntityIds = resource.activeEntityIds.filter((id) => id !== entity.id);
      }

      this.addHistoryLog(entity, node.id, "Arrived", `Reached conveyor discharge endpoint`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} reached end of Conveyor belt ${node.name}`);

      // Try to unblock any waiting items from the conveyor waitlist
      if (resource && resource.waitingEntityIds.length > 0) {
        const nextEntId = resource.waitingEntityIds.shift()!;
        resource.queueLength = resource.waitingEntityIds.length;
        
        this.scheduleEvent({
          id: `conv_start_${node.id}_${nextEntId}`,
          time: this.clockTime,
          type: "ProcessStart",
          nodeId: node.id,
          entityId: nextEntId,
          priority: 4
        });
      }

      // Try pulling from upstream queues to the conveyor
      const inboundNodes = this.layout.connections
        .filter((c) => c.targetId === node.id)
        .map((c) => c.sourceId);

      for (const inId of inboundNodes) {
        this.tryPullFromQueue(inId);
      }

      this.routeEntity(entity, node.id);

    } else if (normType === "transporter") {
      const resource = this.resources[node.id];
      if (resource) {
        resource.occupiedCount = Math.max(0, resource.occupiedCount - 1);
        resource.activeEntityIds = resource.activeEntityIds.filter((id) => id !== entity.id);
      }

      this.addHistoryLog(entity, node.id, "Arrived", `Unloaded from transporter at target station`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} unloaded from Transporter ${node.name}`);

      // Try pulling from upstream queues
      const inboundNodes = this.layout.connections
        .filter((c) => c.targetId === node.id)
        .map((c) => c.sourceId);

      for (const inId of inboundNodes) {
        this.tryPullFromQueue(inId);
      }

      this.routeEntity(entity, node.id);
    } else {
      this.addHistoryLog(entity, node.id, "Arrived", `Step transit finished`);
      this.routeEntity(entity, node.id);
    }
  }

  private routeEntity(entity: SimEntity, currentNodeId: string): void {
    const outputs = this.routes[currentNodeId] || [];
    if (outputs.length === 0) {
      // Reached a dead end or terminal
      const node = this.layout.nodes.find((n) => n.id === currentNodeId);
      if (node && node.type === "sink") {
        this.statsTotalEntered[node.id] = (this.statsTotalEntered[node.id] || 0) + 1;
        this.statsTotalCompleted[node.id] = (this.statsTotalCompleted[node.id] || 0) + 1;
        entity.attributes.cycleTime = this.clockTime - entity.creationTime;

        entity.status = "Completed";
        entity.currentLocationId = node.id;
        entity.routePath.push(node.id);
        this.addHistoryLog(entity, node.id, "Completed", `Reached terminal sink node ${node.name} and completed processing.`);
        this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} reached SINK ${node.name} and completed workflow.`);
      }
      return;
    }

    const currentNode = this.layout.nodes.find((n) => n.id === currentNodeId);
    let targetNodeId = outputs[0];

    // DYNAMIC CONDITIONAL ROUTING RULES
    if (currentNode && outputs.length > 1) {
      const candidateConnections = this.layout.connections.filter(c => c.sourceId === currentNodeId);
      let matchedTargetNodeId: string | null = null;

      for (const conn of candidateConnections) {
        if (!conn.label) continue;
        const label = conn.label.trim();
        const lowerLabel = label.toLowerCase();

        // 1. Match connection label with entity type
        if (lowerLabel === entity.type.toLowerCase()) {
          matchedTargetNodeId = conn.targetId;
          this.log(`[ROUTE] ${entity.id} matches type rule "${entity.type}" -> routing to ${conn.targetId}`);
          break;
        }

        // 2. Match connection label with entity labels
        if (entity.labels && entity.labels.some(l => l.toLowerCase() === lowerLabel)) {
          matchedTargetNodeId = conn.targetId;
          this.log(`[ROUTE] ${entity.id} matches label tag "${label}" -> routing to ${conn.targetId}`);
          break;
        }

        // 3. Match logical expression: e.g. "priority >= 2" or "weight > 100"
        try {
          if (label.includes(">") || label.includes("<") || label.includes("==")) {
            let matchesExpr = false;
            if (label.includes("priority")) {
              const val = parseInt(label.replace(/[^0-9]/g, ""), 10);
              if (label.includes(">=") && entity.priority >= val) matchesExpr = true;
              else if (label.includes(">") && entity.priority > val) matchesExpr = true;
              else if (label.includes("<=") && entity.priority <= val) matchesExpr = true;
              else if (label.includes("<") && entity.priority < val) matchesExpr = true;
              else if (label.includes("==") && entity.priority === val) matchesExpr = true;
            } else if (label.includes("weight") && entity.attributes && entity.attributes.weight !== undefined) {
              const val = parseFloat(label.replace(/[^0-9.]/g, ""));
              const weight = entity.attributes.weight;
              if (label.includes(">=") && weight >= val) matchesExpr = true;
              else if (label.includes(">") && weight > val) matchesExpr = true;
              else if (label.includes("<=") && weight <= val) matchesExpr = true;
              else if (label.includes("<") && weight < val) matchesExpr = true;
              else if (label.includes("==") && weight === val) matchesExpr = true;
            }

            if (matchesExpr) {
              matchedTargetNodeId = conn.targetId;
              this.log(`[ROUTE] ${entity.id} matches expression rule "${label}" -> routing to ${conn.targetId}`);
              break;
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      if (matchedTargetNodeId) {
        targetNodeId = matchedTargetNodeId;
      } else {
        // Fallback probabilities
        if (currentNode && this.getNormalizedType(currentNode.type) === "router") {
          const prob = currentNode.properties.routeProbability ?? 0.5;
          const roll = this.rng.nextDouble();
          targetNodeId = roll <= prob ? outputs[0] : outputs[1];
        } else {
          const idx = Math.floor(this.rng.nextDouble() * outputs.length);
          targetNodeId = outputs[idx];
        }
      }
    }

    const targetNode = this.layout.nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return;

    this.addHistoryLog(entity, currentNodeId, entity.status, `Routed from ${currentNode ? currentNode.name : "Unknown"} to ${targetNode.name}`);

    const targetNormType = this.getNormalizedType(targetNode.type);
    if (targetNormType === "queue") {
      this.scheduleEvent({
        id: `queue_enter_${targetNode.id}_${entity.id}`,
        time: this.clockTime,
        type: "QueueEnter",
        nodeId: targetNode.id,
        entityId: entity.id,
        priority: 4
      });
    } else if (targetNormType === "processor") {
      const resource = this.resources[targetNode.id];
      if (resource && resource.occupiedCount < resource.capacity) {
        // Direct processing (if resources available too!)
        if (this.areResourcesAvailable(targetNode)) {
          this.scheduleEvent({
            id: `proc_start_${targetNode.id}_${entity.id}`,
            time: this.clockTime,
            type: "ProcessStart",
            nodeId: targetNode.id,
            entityId: entity.id,
            priority: 4
          });
        } else {
          this.log(`[BLOCK] ${entity.id} waiting for resources at ${targetNode.name}`);
          const procRes = this.resources[targetNode.id];
          if (procRes && !procRes.waitingEntityIds.includes(entity.id)) {
            procRes.waitingEntityIds.push(entity.id);
            procRes.queueLength = procRes.waitingEntityIds.length;
          }
        }
      } else {
        this.log(`[BLOCK] ${entity.id} blocked: ${targetNode.name} has no available capacity!`);
      }
    } else if (targetNormType === "conveyor") {
      const resource = this.resources[targetNode.id];
      if (resource && resource.occupiedCount < resource.capacity) {
        this.scheduleEvent({
          id: `conv_start_${targetNode.id}_${entity.id}`,
          time: this.clockTime,
          type: "ProcessStart",
          nodeId: targetNode.id,
          entityId: entity.id,
          priority: 4
        });
      } else {
        this.log(`[BLOCK] Conveyor ${targetNode.name} is full!`);
        if (resource && !resource.waitingEntityIds.includes(entity.id)) {
          resource.waitingEntityIds.push(entity.id);
          resource.queueLength = resource.waitingEntityIds.length;
        }
      }
    } else if (targetNormType === "transporter") {
      const resource = this.resources[targetNode.id];
      if (resource && resource.occupiedCount < resource.capacity) {
        this.scheduleEvent({
          id: `trans_start_${targetNode.id}_${entity.id}`,
          time: this.clockTime,
          type: "ProcessStart",
          nodeId: targetNode.id,
          entityId: entity.id,
          priority: 4
        });
      } else {
        this.log(`[BLOCK] Transporter ${targetNode.name} is full!`);
        if (resource && !resource.waitingEntityIds.includes(entity.id)) {
          resource.waitingEntityIds.push(entity.id);
          resource.queueLength = resource.waitingEntityIds.length;
        }
      }
    } else if (targetNormType === "separator") {
      const sepType = targetNode.properties.separatorType || "split";
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} entered Separator ${targetNode.name} (${sepType} mode)`);
      
      if (sepType === "batch-split" && entity.batchedEntities && entity.batchedEntities.length > 0) {
        // UNBATCH / SPLIT COMBINED BATCH back into component parts
        this.log(`[SEPARATOR] Unbatching ${entity.id} back into ${entity.batchedEntities.length} entities`);
        const disbanded = [...entity.batchedEntities];
        entity.status = "Completed";
        this.addHistoryLog(entity, targetNode.id, "Completed", `Unbatched and disbanded assembly at separator ${targetNode.name}`);
        
        for (const sub of disbanded) {
          sub.currentLocationId = targetNode.id;
          sub.status = "Arrived";
          sub.routePath.push(targetNode.id);
          this.addHistoryLog(sub, targetNode.id, "Arrived", `Released from batch ${entity.id} at separator ${targetNode.name}`);
          this.routeEntity(sub, targetNode.id);
        }
      } else {
        // STANDARD SPLIT CLONE
        const sepOutputs = this.routes[targetNode.id] || [];
        if (sepOutputs.length > 0) {
          // Send original downstream
          entity.currentLocationId = targetNode.id;
          entity.routePath.push(targetNode.id);
          this.addHistoryLog(entity, targetNode.id, "Arrived", `Entered separator split station ${targetNode.name}`);
          this.routeEntity(entity, targetNode.id);

          // Clone counterpart
          const clone = this.cloneEntity(entity, "Split");
          clone.currentLocationId = targetNode.id;
          clone.routePath = [...entity.routePath];

          const secondaryTargetId = sepOutputs[1] || sepOutputs[0];
          this.log(`[SEPARATOR] Split cloned ${entity.id} -> counterpart ${clone.id}, routing to ${secondaryTargetId}`);
          this.routeEntity(clone, targetNode.id);
        } else {
          this.routeEntity(entity, targetNode.id);
        }
      }
    } else if (targetNormType === "combiner") {
      const resource = this.resources[targetNode.id];
      const batchSize = targetNode.properties.combinerBatchSize || 2;
      
      if (resource) {
        resource.waitingEntityIds.push(entity.id);
        resource.queueLength = resource.waitingEntityIds.length;
        entity.currentLocationId = targetNode.id;
        entity.status = "Queued";
        this.addHistoryLog(entity, targetNode.id, "Queued", `Buffered at combiner ${targetNode.name} waiting for batch size ${batchSize}`);
        
        this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} buffered at Combiner ${targetNode.name} (${resource.waitingEntityIds.length}/${batchSize})`);
        
        if (resource.waitingEntityIds.length >= batchSize) {
          const mergedIds = [...resource.waitingEntityIds];
          resource.waitingEntityIds = [];
          resource.queueLength = 0;
          
          this.log(`[COMBINER] Batch size ${batchSize} met at ${targetNode.name}. Merging units: ${mergedIds.join(", ")}`);
          
          const mainEntityId = mergedIds[0];
          const mainEntity = this.entities.find(e => e.id === mainEntityId);
          if (mainEntity) {
            mainEntity.name = `Assembly Batch [${mergedIds.length} units]`;
            mainEntity.priority = 3;
            mainEntity.labels = [...mainEntity.labels, "batched", "assembly"];
            mainEntity.attributes = {
              ...mainEntity.attributes,
              batchedCount: mergedIds.length,
              combinedTime: this.clockTime
            };
            mainEntity.routePath.push(targetNode.id);

            // Populate nested batch list
            mainEntity.batchedEntities = mergedIds.map(id => this.entities.find(e => e.id === id)!).filter(Boolean);

            // Mark nested items as Queued / stored in batch
            mergedIds.slice(1).forEach(id => {
              const other = this.entities.find(e => e.id === id);
              if (other) {
                other.status = "Queued";
                other.currentLocationId = targetNode.id;
                this.addHistoryLog(other, targetNode.id, "Queued", `Combined and packed inside Assembly Batch ${mainEntity.id}`);
              }
            });
            
            this.addHistoryLog(mainEntity, targetNode.id, "Arrived", `Assembled batch completed at ${targetNode.name}`);
            this.routeEntity(mainEntity, targetNode.id);
          }
        }
      }
    } else if (targetNode.type === "resource") {
      this.log(`[WARNING] Entity ${entity.id} routed directly to Resource pool ${targetNode.name}. Routing bypassed.`);
      entity.routePath.push(targetNode.id);
      this.routeEntity(entity, targetNode.id);
    } else if (targetNode.type === "sink") {
      entity.currentLocationId = targetNode.id;
      entity.status = "Completed";
      entity.routePath.push(targetNode.id);
      this.addHistoryLog(entity, targetNode.id, "Completed", `Reached workflow exit sink ${targetNode.name}`);
      this.log(`[T=${this.clockTime.toFixed(2)}s] ${entity.id} completed flow at ${targetNode.name}`);
    } else {
      entity.routePath.push(targetNode.id);
      this.routeEntity(entity, targetNode.id);
    }
  }

  private tryPullFromQueue(queueId: string): void {
    const queueNode = this.layout.nodes.find((n) => n.id === queueId);
    if (!queueNode) return;

    const queueRes = this.resources[queueId];
    if (!queueRes || queueRes.waitingEntityIds.length === 0) return;

    // Find downstream processors or conveyors
    const downstreamIds = this.routes[queueId] || [];
    for (const pId of downstreamIds) {
      const pNode = this.layout.nodes.find((n) => n.id === pId);
      if (pNode) {
        if (pNode.type === "processor") {
          const procRes = this.resources[pId];
          if (procRes && procRes.occupiedCount < procRes.capacity) {
            if (!this.areResourcesAvailable(pNode)) {
              this.log(`[BLOCK] Downstream ${pNode.name} cannot pull from ${queueNode.name}: Required resources are busy.`);
              continue; 
            }

            // Dequeue entity from waiting queue
            const nextEntityId = queueRes.waitingEntityIds.shift()!;
            queueRes.queueLength = queueRes.waitingEntityIds.length;
            
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

            break;
          }
        } else if (pNode.type === "conveyor") {
          const convRes = this.resources[pId];
          if (convRes && convRes.occupiedCount < convRes.capacity) {
            const nextEntityId = queueRes.waitingEntityIds.shift()!;
            queueRes.queueLength = queueRes.waitingEntityIds.length;

            this.scheduleEvent({
              id: `queue_exit_${queueId}_${nextEntityId}`,
              time: this.clockTime,
              type: "QueueExit",
              nodeId: queueId,
              entityId: nextEntityId,
              priority: 2
            });

            this.scheduleEvent({
              id: `conv_start_${pId}_${nextEntityId}`,
              time: this.clockTime,
              type: "ProcessStart",
              nodeId: pId,
              entityId: nextEntityId,
              priority: 4
            });

            break;
          }
        } else if (pNode.type === "transporter") {
          const transRes = this.resources[pId];
          if (transRes && transRes.occupiedCount < transRes.capacity) {
            const nextEntityId = queueRes.waitingEntityIds.shift()!;
            queueRes.queueLength = queueRes.waitingEntityIds.length;

            this.scheduleEvent({
              id: `queue_exit_${queueId}_${nextEntityId}`,
              time: this.clockTime,
              type: "QueueExit",
              nodeId: queueId,
              entityId: nextEntityId,
              priority: 2
            });

            this.scheduleEvent({
              id: `trans_start_${pId}_${nextEntityId}`,
              time: this.clockTime,
              type: "ProcessStart",
              nodeId: pId,
              entityId: nextEntityId,
              priority: 4
            });

            break;
          }
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

  private recordTimeSeriesPoint(): void {
    const time = this.clockTime;
    if (time === this.statsLastTimeSeriesTime) return;
    
    // Capture every 1s or significantly advanced clock step
    if (time - this.statsLastTimeSeriesTime < 1.0 && time !== 0) {
      return;
    }
    
    this.statsLastTimeSeriesTime = time;

    const completed = this.entities.filter(e => e.status === "Completed");
    const active = this.entities.filter(e => e.status !== "Completed");
    
    let avgCycle = 0;
    let avgWait = 0;
    if (completed.length > 0) {
      const sumCycle = completed.reduce((sum, e) => sum + (e.attributes.cycleTime || 0), 0);
      avgCycle = sumCycle / completed.length;
      const sumWait = completed.reduce((sum, e) => sum + (e.attributes.totalWaitingTime || 0), 0);
      avgWait = sumWait / completed.length;
    }

    const currentUtil: Record<string, number> = {};
    const currentQLen: Record<string, number> = {};

    for (const node of this.layout.nodes) {
      if (this.resources[node.id]) {
        currentUtil[node.id] = (this.resources[node.id].utilization || 0) * 100;
        currentQLen[node.id] = this.resources[node.id].queueLength || 0;
      }
    }

    this.statsTimeSeries.push({
      time: Math.round(time * 10) / 10,
      throughput: completed.length,
      wip: active.length,
      averageCycleTime: Math.round(avgCycle * 10) / 10,
      averageWaitingTime: Math.round(avgWait * 10) / 10,
      utilization: currentUtil,
      queueLengths: currentQLen
    });

    if (this.statsTimeSeries.length > 300) {
      this.statsTimeSeries.shift();
    }
  }

  public getAnalytics(): any {
    const completedEntities = this.entities.filter(e => e.status === "Completed");
    const activeEntities = this.entities.filter(e => e.status !== "Completed");

    const totalCompleted = completedEntities.length;
    const totalArrived = this.entities.length;
    const currentWIP = activeEntities.length;

    const throughputRate = this.clockTime > 0 ? (totalCompleted / this.clockTime) : 0;

    let totalCycleTime = 0;
    let maxCycleTime = 0;
    let minCycleTime = totalCompleted > 0 ? Infinity : 0;

    let totalWaitingTimeAllCompleted = 0;
    let totalProcessingTimeAllCompleted = 0;

    for (const ent of completedEntities) {
      const cycle = ent.attributes.cycleTime || 0;
      totalCycleTime += cycle;
      if (cycle > maxCycleTime) maxCycleTime = cycle;
      if (cycle < minCycleTime) minCycleTime = cycle;

      totalWaitingTimeAllCompleted += ent.attributes.totalWaitingTime || 0;
      totalProcessingTimeAllCompleted += ent.attributes.totalProcessingTime || 0;
    }

    if (minCycleTime === Infinity) minCycleTime = 0;

    const averageCycleTime = totalCompleted > 0 ? (totalCycleTime / totalCompleted) : 0;
    const averageWaitingTime = totalCompleted > 0 ? (totalWaitingTimeAllCompleted / totalCompleted) : 0;
    const averageProcessingTime = totalCompleted > 0 ? (totalProcessingTimeAllCompleted / totalCompleted) : 0;

    const nodeMetrics: Record<string, any> = {};
    const bottlenecks: { nodeId: string; name: string; score: number; reason: string; }[] = [];

    for (const node of this.layout.nodes) {
      const entered = this.statsTotalEntered[node.id] || 0;
      const completedCount = this.statsTotalCompleted[node.id] || 0;
      const wip = Math.max(0, entered - completedCount);

      // Average queue length calculation: (time-integral / clockTime)
      const qLenIntegral = this.statsQueueLengthTimeIntegral[node.id] || 0;
      const averageQueueLength = this.clockTime > 0 ? (qLenIntegral / this.clockTime) : 0;
      const maxQueueLength = this.statsMaxQueueLength[node.id] || 0;

      // Waiting and processing time averages at this node
      const waitTimeIntegral = this.statsWaitingTimeIntegral[node.id] || 0;
      const averageNodeWaitingTime = completedCount > 0 ? (waitTimeIntegral / completedCount) : 0;

      const procTimeIntegral = this.statsProcessingTimeIntegral[node.id] || 0;
      const averageNodeProcessingTime = completedCount > 0 ? (procTimeIntegral / completedCount) : 0;

      const utilization = this.resources[node.id]?.utilization || 0;

      nodeMetrics[node.id] = {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        totalEntered: entered,
        totalCompleted: completedCount,
        currentWIP: wip,
        averageWaitingTime: averageNodeWaitingTime,
        averageProcessingTime: averageNodeProcessingTime,
        averageTotalTime: averageNodeWaitingTime + averageNodeProcessingTime,
        utilization: utilization * 100,
        currentQueueLength: this.resources[node.id]?.queueLength || 0,
        maxQueueLength,
        averageQueueLength
      };

      // Bottleneck detection score
      let bScore = 0;
      let bReason = "";

      if (node.type === "queue") {
        bScore = Math.min(100, averageQueueLength * 25 + (wip * 10));
        if (bScore > 5) {
          bReason = `High average queue length of ${averageQueueLength.toFixed(2)} units (Max: ${maxQueueLength})`;
        }
      } else if (node.type === "processor" || node.type === "conveyor" || node.type === "transporter") {
        bScore = utilization * 100;
        if (bScore > 75) {
          bReason = `High utilization at ${(utilization * 100).toFixed(1)}%`;
        }
      }

      if (bScore > 5 && bReason) {
        bottlenecks.push({
          nodeId: node.id,
          name: node.name,
          score: Math.round(bScore),
          reason: bReason
        });
      }
    }

    // Sort bottlenecks by score descending
    bottlenecks.sort((a, b) => b.score - a.score);

    return {
      throughputRate,
      totalCompleted,
      totalArrived,
      currentWIP,
      averageCycleTime,
      maxCycleTime,
      minCycleTime,
      averageWaitingTime,
      averageProcessingTime,
      nodeMetrics,
      bottlenecks,
      timeSeries: [...this.statsTimeSeries]
    };
  }

  public resetStatistics(): void {
    for (const node of this.layout.nodes) {
      this.statsTotalEntered[node.id] = 0;
      this.statsTotalCompleted[node.id] = 0;
      this.statsProcessingTimeIntegral[node.id] = 0;
      this.statsWaitingTimeIntegral[node.id] = 0;
      this.statsMaxQueueLength[node.id] = 0;
      this.statsQueueLengthTimeIntegral[node.id] = 0;
      this.statsLastQueueChangeTime[node.id] = this.clockTime;
    }
    this.statsTimeSeries = [];
    this.statsLastTimeSeriesTime = this.clockTime;

    for (const entity of this.entities) {
      if (entity.attributes) {
        entity.attributes.totalWaitingTime = 0;
        entity.attributes.totalProcessingTime = 0;
        if (entity.status === "Queued") {
          entity.attributes.queueEnterTime = this.clockTime;
        } else if (entity.status === "InService") {
          entity.attributes.processStartTime = this.clockTime;
        }
      }
    }

    this.log(`[SYSTEM] Statistics counter reset. High-fidelity metrics tracking restarted at T=${this.clockTime.toFixed(2)}s`);
  }

  public getSummary(): SimulationStateSummary {
    return {
      clockTime: this.clockTime,
      state: this.state,
      stepCount: this.stepCount,
      entities: [...this.entities],
      resources: JSON.parse(JSON.stringify(this.resources)),
      recentLogs: [...this.logs],
      analytics: this.getAnalytics()
    };
  }
}
