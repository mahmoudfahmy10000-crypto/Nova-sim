import { SimulationLayout, SimNode, SimConnection } from "./types";

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    nodeCount: number;
    connectionCount: number;
    sourceCount: number;
    sinkCount: number;
    hasIsolatedNodes: boolean;
  };
}

/**
 * Validates a loaded or imported project JSON structure.
 * Performs deep type checks, uniqueness checks, and layout sanity checks.
 */
export function validateProjectJSON(data: any): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic Envelope Structure Checks
  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Project payload is empty or not a valid JSON object."], warnings: [] };
  }

  // Allow both direct SimulationLayout structure OR a full Project container structure
  let layout: any = null;
  let name = "Unnamed Project";
  let description = "";

  if ("layout" in data) {
    layout = data.layout;
    name = typeof data.name === "string" ? data.name : name;
    description = typeof data.description === "string" ? data.description : description;
  } else if ("nodes" in data && "connections" in data) {
    layout = data;
  } else {
    return {
      isValid: false,
      errors: ["Invalid structure. Must contain 'layout' or 'nodes' & 'connections' properties."],
      warnings: []
    };
  }

  if (!layout || typeof layout !== "object") {
    return { isValid: false, errors: ["Simulation layout parameter is corrupt or unreadable."], warnings: [] };
  }

  const nodes: any[] = Array.isArray(layout.nodes) ? layout.nodes : [];
  const connections: any[] = Array.isArray(layout.connections) ? layout.connections : [];

  if (!Array.isArray(layout.nodes)) {
    errors.push("Layout 'nodes' must be a valid JSON array.");
  }
  if (!Array.isArray(layout.connections)) {
    errors.push("Layout 'connections' must be a valid JSON array.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // 2. Validate Nodes and Properties
  const nodeIds = new Set<string>();
  let sourceCount = 0;
  let sinkCount = 0;

  nodes.forEach((node, idx) => {
    const nodeLabel = node?.name || `Node[${idx}]`;

    if (!node || typeof node !== "object") {
      errors.push(`Node at index ${idx} is not a valid object.`);
      return;
    }

    // Required fields
    if (typeof node.id !== "string" || !node.id.trim()) {
      errors.push(`Node at index ${idx} is missing a valid 'id' string.`);
    } else {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID detected: '${node.id}' used by '${nodeLabel}'.`);
      }
      nodeIds.add(node.id);
    }

    const validTypes = ["source", "queue", "processor", "sink", "router", "conveyor", "resource", "transporter", "separator", "combiner"];
    if (typeof node.type !== "string" || !validTypes.includes(node.type)) {
      errors.push(`Node '${nodeLabel}' has an invalid type: '${node.type}'. Supported types: ${validTypes.join(", ")}`);
    } else {
      if (node.type === "source") sourceCount++;
      if (node.type === "sink") sinkCount++;
    }

    if (typeof node.name !== "string" || !node.name.trim()) {
      warnings.push(`Node ID '${node.id}' is missing a descriptive label string.`);
    }

    if (typeof node.x !== "number" || isNaN(node.x) || typeof node.y !== "number" || isNaN(node.y)) {
      errors.push(`Node '${nodeLabel}' coordinates [x, y] must be valid numerical values.`);
    } else {
      if (node.x < -10000 || node.x > 10000 || node.y < -10000 || node.y > 10000) {
        warnings.push(`Node '${nodeLabel}' is positioned extremely far off-screen (${Math.round(node.x)}, ${Math.round(node.y)}).`);
      }
    }

    // Node Properties check
    const props = node.properties || {};
    if (typeof props !== "object") {
      errors.push(`Node '${nodeLabel}' properties must be a key-value object structure.`);
    } else {
      // Validate specific simulation constraints
      if (node.type === "source" && typeof props.arrivalInterval === "number" && props.arrivalInterval <= 0) {
        errors.push(`Source '${nodeLabel}' has invalid negative or zero arrival interval: ${props.arrivalInterval}s.`);
      }
      if (node.type === "processor" && typeof props.processingTime === "number" && props.processingTime < 0) {
        errors.push(`Processor '${nodeLabel}' has invalid negative processing time: ${props.processingTime}s.`);
      }
      if (node.type === "queue" && typeof props.capacity === "number" && props.capacity < 1) {
        errors.push(`Queue '${nodeLabel}' has invalid capacity: ${props.capacity}. Minimum queue capacity is 1.`);
      }
      if (node.type === "router" && typeof props.routeProbability === "number" && (props.routeProbability < 0 || props.routeProbability > 1)) {
        errors.push(`Router '${nodeLabel}' branching probability '${props.routeProbability}' must be between 0.0 and 1.0.`);
      }
    }
  });

  // 3. Validate Connections / Routing Topology
  const connectionIds = new Set<string>();
  const connectedNodeIds = new Set<string>();

  connections.forEach((conn, idx) => {
    const connLabel = conn?.id || `Connection[${idx}]`;

    if (!conn || typeof conn !== "object") {
      errors.push(`Connection at index ${idx} is not a valid object.`);
      return;
    }

    if (typeof conn.id !== "string" || !conn.id.trim()) {
      warnings.push(`Connection at index ${idx} is missing a unique ID. Assigning auto-generated one.`);
    } else {
      if (connectionIds.has(conn.id)) {
        warnings.push(`Duplicate connection ID found: '${conn.id}'. Automatically assigning a random tag to avoid collision.`);
      }
      connectionIds.add(conn.id);
    }

    if (typeof conn.sourceId !== "string" || !nodeIds.has(conn.sourceId)) {
      errors.push(`Connection '${connLabel}' specifies a missing or invalid source node ID: '${conn.sourceId}'.`);
    } else {
      connectedNodeIds.add(conn.sourceId);
    }

    if (typeof conn.targetId !== "string" || !nodeIds.has(conn.targetId)) {
      errors.push(`Connection '${connLabel}' specifies a missing or invalid target node ID: '${conn.targetId}'.`);
    } else {
      connectedNodeIds.add(conn.targetId);
    }

    if (conn.sourceId === conn.targetId && conn.sourceId !== undefined) {
      warnings.push(`Self-loop detected on Node '${conn.sourceId}'. This can cause immediate infinite event loops.`);
    }
  });

  // 4. Isolated / Detached Nodes Warn
  let hasIsolatedNodes = false;
  nodes.forEach((node) => {
    if (node.id && !connectedNodeIds.has(node.id)) {
      warnings.push(`Node '${node.name || node.id}' is isolated with zero connected inlet or outlet links.`);
      hasIsolatedNodes = true;
    }
  });

  // Flow alerts
  if (nodes.length > 0) {
    if (sourceCount === 0) {
      warnings.push("Simulation layout has no 'Source' nodes. No items will enter the process flow.");
    }
    if (sinkCount === 0) {
      warnings.push("Simulation layout has no 'Sink' nodes. Material cannot exit and may accumulate indefinitely.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      nodeCount: nodes.length,
      connectionCount: connections.length,
      sourceCount,
      sinkCount,
      hasIsolatedNodes
    }
  };
}
