export type NodeType =
  | "source"
  | "queue"
  | "processor"
  | "sink"
  | "router"
  | "conveyor"
  | "resource"
  | "transporter"
  | "separator"
  | "combiner";

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
  resourceType?: "Worker" | "Tool" | "Fixture" | "Space";
  quantity?: number;
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
export interface SimEntity {
  id: string;
  name: string;
  type: string;
  color: string;
  creationTime: number;
  currentLocationId: string;
  status: "Arrived" | "Queued" | "InService" | "Completed";
  routePath: string[]; // History of visited nodes
}

export interface SimEvent {
  id: string;
  time: number;
  type: "Arrival" | "ProcessStart" | "ProcessComplete" | "QueueEnter" | "QueueExit";
  nodeId: string;
  entityId: string;
  priority: number;
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
}

export interface SimulationStateSummary {
  clockTime: number;
  state: "Created" | "Running" | "Paused" | "Stopped" | "Completed";
  stepCount: number;
  entities: SimEntity[];
  resources: Record<string, ResourceState>;
  recentLogs: string[];
}
