export type NodeType =
  | "source"
  | "sink"
  | "queue"
  | "processor"
  | "delay"
  | "combiner"
  | "separator"
  | "batch"
  | "split"
  | "conveyor"
  | "transporter"
  | "agv"
  | "forklift"
  | "crane"
  | "elevator"
  | "robot"
  | "operator"
  | "worker"
  | "machine"
  | "buffer"
  | "storage"
  | "rack"
  | "pallet"
  | "container"
  | "sensor"
  | "decision"
  | "router"
  | "merge"
  | "transfer"
  | "network node"
  | "path"
  | "custom object"
  | "resource";

export interface NodeProperties {
  arrivalInterval?: number; // Mean interval for sources
  processingTime?: number;  // Mean processing time for machines
  capacity?: number;        // Capacity for processors/queues (default 1)
  distribution?: "constant" | "exponential" | "normal"; // Stochastic model
  routeProbability?: number; // Probability for router split
  color?: string;
  // Conveyor properties
  conveyorSpeed?: number;   // Speed in m/s
  conveyorLength?: number;  // Length in meters
  // Resource properties
  resourceType?: "Worker" | "Tool" | "Fixture" | "Space" | "Operator" | "Machine";
  quantity?: number;
  // Extended resource properties for Phase 10
  shiftEnabled?: boolean;
  shiftStart?: number;
  shiftEnd?: number;
  shiftCycle?: number;
  breakEnabled?: boolean;
  breakStart?: number;
  breakEnd?: number;
  breakCycle?: number;
  failureEnabled?: boolean;
  failureMTBF?: number;
  failureMTTR?: number;
  maintenanceEnabled?: boolean;
  maintenanceInterval?: number;
  maintenanceDuration?: number;
  // Transporter properties
  transporterSpeed?: number;
  transporterCapacity?: number;
  // Separator properties
  separatorType?: "split" | "batch-split";
  separatorSplitRatio?: number; // Split proportion or batch divider
  // Combiner properties
  combinerType?: "batch" | "pack";
  combinerBatchSize?: number;
  // Size and rotation properties
  width?: number;
  height?: number;
  rotation?: number;
  // Metadata custom properties
  isLocked?: boolean;
  showLabel?: boolean;
  showStatsLabel?: boolean;
}

export interface SimNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  properties: NodeProperties;
}

export interface SimConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  weight?: number;
  delay?: number;
  color?: string;
  style?: "bezier" | "orthogonal" | "straight";
  dashArray?: string;
}

export interface SimulationLayout {
  nodes: SimNode[];
  connections: SimConnection[];
  zoom?: number;
  panOffsetX?: number;
  panOffsetY?: number;
  showGrid?: boolean;
  snapSize?: number;
}

export interface SimulationProject {
  id: string;
  name: string;
  description: string;
  layout: SimulationLayout;
  createdAt: string;
  updatedAt: string;
}

// Runtime Simulation Types
export interface EntityHistoryItem {
  time: number;
  nodeId: string;
  nodeName: string;
  status: string;
  description: string;
}

export interface SimEntity {
  id: string;
  name: string;
  type: string; // e.g., "Standard", "Heavy", "Express", "VIP"
  color: string;
  creationTime: number;
  currentLocationId: string;
  status: "Arrived" | "Queued" | "InService" | "Completed";
  routePath: string[]; // History of visited nodes
  priority: number; // Priority rating (higher priority processed first)
  labels: string[]; // Dynamic labels/tags e.g. ["processed", "inspected"]
  attributes: Record<string, any>; // Arbitrary custom attributes, e.g. { weight: 12.5, temp: 42 }
  history: EntityHistoryItem[]; // Detailed audit log of state changes
  batchedEntities?: SimEntity[]; // Original entities grouped in a batch (for combiners/batching)
  parentEntityId?: string; // If this entity was cloned/split from a parent
}

export interface SimEvent {
  id: string;
  time: number;
  type: "Arrival" | "ProcessStart" | "ProcessComplete" | "QueueEnter" | "QueueExit";
  nodeId: string;
  entityId: string;
  priority: number;
}

export interface ResourceUnitState {
  id: string;
  name: string;
  state: "Idle" | "Busy" | "Breakdown" | "OnBreak" | "OffShift" | "UnderMaintenance";
  assignedEntityId: string | null;
  timeInStates: {
    Idle: number;
    Busy: number;
    Breakdown: number;
    OnBreak: number;
    OffShift: number;
    UnderMaintenance: number;
  };
  lastStateChangeTime: number;
  
  // Failure / maintenance trackers for this specific unit
  nextFailureTime: number;
  nextMaintenanceTime: number;
  maintenanceEndTime: number;
  repairEndTime: number;
}

export interface ResourceState {
  nodeId: string;
  name: string;
  capacity: number;
  occupiedCount: number;
  queueLength: number;
  activeEntityIds: string[];
  waitingEntityIds: string[];
  utilization: number; // 0 to 1
  totalBusyTime: number;

  // Rich resource system fields (Phase 10)
  resourceType: "Worker" | "Tool" | "Fixture" | "Space" | "Operator" | "Machine";
  units?: ResourceUnitState[];
  
  // General pool configuration
  shiftEnabled?: boolean;
  shiftStart?: number;
  shiftEnd?: number;
  shiftCycle?: number;
  
  breakEnabled?: boolean;
  breakStart?: number;
  breakEnd?: number;
  breakCycle?: number;

  failureEnabled?: boolean;
  failureMTBF?: number;
  failureMTTR?: number;

  maintenanceEnabled?: boolean;
  maintenanceInterval?: number;
  maintenanceDuration?: number;
}

export interface SimNodeKPIs {
  nodeId: string;
  name: string;
  type: string;
  totalEntered: number;
  totalCompleted: number;
  currentWIP: number;
  averageWaitingTime: number;
  averageProcessingTime: number;
  averageTotalTime: number;
  utilization: number;
  currentQueueLength: number;
  maxQueueLength: number;
  averageQueueLength: number;
}

export interface SimulationTimeSeriesPoint {
  time: number;
  throughput: number;
  wip: number;
  averageCycleTime: number;
  averageWaitingTime: number;
  utilization: Record<string, number>;
  queueLengths: Record<string, number>;
}

export interface SimulationAnalytics {
  throughputRate: number;
  totalCompleted: number;
  totalArrived: number;
  currentWIP: number;
  averageCycleTime: number;
  maxCycleTime: number;
  minCycleTime: number;
  averageWaitingTime: number;
  averageProcessingTime: number;
  nodeMetrics: Record<string, SimNodeKPIs>;
  bottlenecks: {
    nodeId: string;
    name: string;
    score: number;
    reason: string;
  }[];
  timeSeries: SimulationTimeSeriesPoint[];
}

export interface SimulationStateSummary {
  clockTime: number;
  state: "Created" | "Running" | "Paused" | "Stopped" | "Completed";
  stepCount: number;
  entities: SimEntity[];
  resources: Record<string, ResourceState>;
  recentLogs: string[];
  analytics?: SimulationAnalytics;
}
