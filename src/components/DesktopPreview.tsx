import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Clock,
  Activity,
  Cpu,
  Database,
  Terminal,
  Settings,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Gauge,
  Sliders,
  PlayCircle
} from "lucide-react";

// Types
export interface SimEntity {
  id: string;
  name: string;
  type: string;
  status: "Arrived" | "Queued" | "InService" | "Completed";
  currentStage: number; // 0: Arrival, 1: Lathe, 2: CNC, 3: Laser, 4: Finished
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  arrivalTime: number;
  startTime?: number;
  completionTime?: number;
}

export interface SimEvent {
  id: string;
  time: number;
  type: "Arrival" | "LatheComplete" | "CNCComplete" | "LaserComplete";
  entityId: string;
  priority: number;
}

export interface SimResource {
  id: string;
  name: string;
  capacity: number;
  occupiedBy: string | null; // Entity ID
  queue: string[]; // Entity IDs
  totalBusyTime: number;
  utilization: number;
}

export default function DesktopPreview() {
  // Config parameters
  const [endTime, setEndTime] = useState<number>(100.0);
  const [simSpeed, setSimSpeed] = useState<number>(1.0); // 1.0x, 2.0x, etc.
  const [seed, setSeed] = useState<number>(42);
  const [arrivalInterval, setArrivalInterval] = useState<number>(12.0); // Mean arrival interval

  // Engine States
  const [clockTime, setClockTime] = useState<number>(0.0);
  const [stepCount, setStepCount] = useState<number>(0);
  const [simState, setSimState] = useState<"Created" | "Running" | "Paused" | "Stopped" | "Completed">("Created");
  
  // Simulation collections
  const [entities, setEntities] = useState<SimEntity[]>([]);
  const [futureEvents, setFutureEvents] = useState<SimEvent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  // Resources State
  const [resources, setResources] = useState<Record<string, SimResource>>({
    lathe: {
      id: "lathe",
      name: "Lathe Machine (Stage 1)",
      capacity: 1,
      occupiedBy: null,
      queue: [],
      totalBusyTime: 0,
      utilization: 0,
    },
    cnc: {
      id: "cnc",
      name: "CNC Router (Stage 2)",
      capacity: 1,
      occupiedBy: null,
      queue: [],
      totalBusyTime: 0,
      utilization: 0,
    },
    laser: {
      id: "laser",
      name: "Laser Cutter (Stage 3)",
      capacity: 1,
      occupiedBy: null,
      queue: [],
      totalBusyTime: 0,
      utilization: 0,
    },
  });

  // State refs to read inside intervals securely
  const stateRef = useRef({
    clockTime,
    simState,
    entities,
    futureEvents,
    resources,
    stepCount,
    endTime,
    simSpeed,
    arrivalInterval
  });

  // Keep state refs in sync
  useEffect(() => {
    stateRef.current = {
      clockTime,
      simState,
      entities,
      futureEvents,
      resources,
      stepCount,
      endTime,
      simSpeed,
      arrivalInterval
    };
  }, [clockTime, simState, entities, futureEvents, resources, stepCount, endTime, simSpeed, arrivalInterval]);

  // Terminal scroll helper
  const terminalEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Reset simulation to initial parameters
  const handleReset = () => {
    setClockTime(0.0);
    setStepCount(0);
    setSimState("Created");
    setEntities([]);
    setLogs([
      `[00:00:00] [INFO] [CONTROLLER] NovaSim Simulation Engine initialized.`,
      `[00:00:00] [INFO] [CONTROLLER] Seed initialized to ${seed}. EndTime limit set to ${endTime}s.`,
      `[00:00:00] [INFO] [CONTROLLER] State transition: 'None' ===> 'Created'`
    ]);

    // Re-init resources
    setResources({
      lathe: { id: "lathe", name: "Lathe Machine (Stage 1)", capacity: 1, occupiedBy: null, queue: [], totalBusyTime: 0, utilization: 0 },
      cnc: { id: "cnc", name: "CNC Router (Stage 2)", capacity: 1, occupiedBy: null, queue: [], totalBusyTime: 0, utilization: 0 },
      laser: { id: "laser", name: "Laser Cutter (Stage 3)", capacity: 1, occupiedBy: null, queue: [], totalBusyTime: 0, utilization: 0 },
    });

    // Schedule initial events (first arrival at t=2.0)
    const initialEvents: SimEvent[] = [
      { id: "evt_1", time: 2.0, type: "Arrival", entityId: "part_1", priority: 1 },
    ];
    setFutureEvents(initialEvents);
  };

  // Run simulation on component mount/reset
  useEffect(() => {
    handleReset();
  }, [seed, endTime]);

  // Dynamic simulation timer loop
  useEffect(() => {
    if (simState !== "Running") return;

    const intervalPeriod = 100; // 100ms real time interval
    const timer = setInterval(() => {
      const current = stateRef.current;
      
      // Calculate clock advancement (e.g. 0.5s simulation time per 100ms real time * simSpeed)
      const clockDelta = 0.5 * current.simSpeed;
      const nextClockTime = Math.min(current.clockTime + clockDelta, current.endTime);

      // Check if we reached end of simulation
      if (nextClockTime >= current.endTime) {
        setClockTime(current.endTime);
        setSimState("Completed");
        setLogs((prev) => [
          ...prev,
          `[${formatTime(current.endTime)}] [INFO] [CONTROLLER] Next event exceeds EndTime ${current.endTime.toFixed(4)}. Simulation finished.`,
          `[${formatTime(current.endTime)}] [INFO] [CONTROLLER] State transition: 'Running' ===> 'Completed'`
        ]);
        clearInterval(timer);
        return;
      }

      // Collect all events scheduled up to the next clock time
      // Sort events chronologically to process them in strict order
      let tempEvents = [...current.futureEvents];
      tempEvents.sort((a, b) => a.time - b.time || a.priority - b.priority);

      let processedEventsCount = 0;
      let activeEvents = tempEvents.filter(evt => evt.time <= nextClockTime);

      let currentClock = current.clockTime;
      let localEntities = [...current.entities];
      let localEvents = [...current.futureEvents];
      let localResources = JSON.parse(JSON.stringify(current.resources)) as Record<string, SimResource>;
      let stepIncrement = 0;
      const newLogs: string[] = [];

      // Process all events ready to run in this tick sequentially
      for (const event of activeEvents) {
        currentClock = event.time;
        stepIncrement++;

        // Dequeue this event
        localEvents = localEvents.filter(e => e.id !== event.id);

        if (event.type === "Arrival") {
          // Determine entity ID and metadata
          const entityId = event.entityId;
          const entityIdx = parseInt(entityId.split("_")[1]) || 1;
          
          // Generate entity
          const entityTypes = ["Titanium Axle", "Aluminium Bracket", "Steel Impeller", "Brass Gear"];
          const colors = ["#818cf8", "#34d399", "#f59e0b", "#f43f5e"];
          const typeStr = entityTypes[(entityIdx - 1) % entityTypes.length];
          const colorStr = colors[(entityIdx - 1) % colors.length];

          const newEntity: SimEntity = {
            id: entityId,
            name: `Part ${entityIdx}`,
            type: typeStr,
            status: "Arrived",
            currentStage: 0, // Waiting stage
            color: colorStr,
            x: 40,
            y: 80,
            targetX: 80,
            targetY: 150,
            arrivalTime: currentClock
          };

          localEntities.push(newEntity);
          newLogs.push(`[${formatTime(currentClock)}] [INFO] [DISPATCHER] Processing event 'Arrival' for Entity: ${newEntity.name} (${newEntity.type})`);

          // Route immediately to stage 1 (Lathe)
          routeEntityToResource(newEntity, "lathe", currentClock, localEntities, localResources, localEvents, newLogs);

          // Schedule NEXT arrival (Poisson-like/Fixed interval)
          const nextArrivalTime = currentClock + current.arrivalInterval;
          const nextEntityId = `part_${entityIdx + 1}`;
          localEvents.push({
            id: `evt_arr_${entityIdx + 1}`,
            time: nextArrivalTime,
            type: "Arrival",
            entityId: nextEntityId,
            priority: 1
          });
        }
        else if (event.type === "LatheComplete") {
          const entity = localEntities.find(e => e.id === event.entityId);
          if (entity) {
            newLogs.push(`[${formatTime(currentClock)}] [PASS] should complete Lathe Machine operations for ${entity.name}`);
            
            // Release Lathe Machine
            const res = localResources.lathe;
            res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
            res.occupiedBy = null;
            newLogs.push(`[${formatTime(currentClock)}] [INFO] [RESOURCE] Lathe Machine: Release(${entity.name}) -> SUCCESS`);

            // Route entity to CNC Router (Stage 2)
            entity.currentStage = 2;
            routeEntityToResource(entity, "cnc", currentClock, localEntities, localResources, localEvents, newLogs);

            // Trigger next queued item on Lathe
            processQueue(res, "lathe", "LatheComplete", currentClock, localEntities, localEvents, newLogs);
          }
        }
        else if (event.type === "CNCComplete") {
          const entity = localEntities.find(e => e.id === event.entityId);
          if (entity) {
            newLogs.push(`[${formatTime(currentClock)}] [PASS] should complete CNC Router carving for ${entity.name}`);

            // Release CNC Router
            const res = localResources.cnc;
            res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
            res.occupiedBy = null;
            newLogs.push(`[${formatTime(currentClock)}] [INFO] [RESOURCE] CNC Router: Release(${entity.name}) -> SUCCESS`);

            // Route entity to Laser Cutter (Stage 3)
            entity.currentStage = 3;
            routeEntityToResource(entity, "laser", currentClock, localEntities, localResources, localEvents, newLogs);

            // Trigger next queued item on CNC
            processQueue(res, "cnc", "CNCComplete", currentClock, localEntities, localEvents, newLogs);
          }
        }
        else if (event.type === "LaserComplete") {
          const entity = localEntities.find(e => e.id === event.entityId);
          if (entity) {
            newLogs.push(`[${formatTime(currentClock)}] [PASS] should complete Laser engraving for ${entity.name}`);

            // Release Laser
            const res = localResources.laser;
            res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
            res.occupiedBy = null;
            newLogs.push(`[${formatTime(currentClock)}] [INFO] [RESOURCE] Laser Cutter: Release(${entity.name}) -> SUCCESS`);

            // Entity completes everything
            entity.status = "Completed";
            entity.currentStage = 4; // Finished
            entity.completionTime = currentClock;
            entity.targetX = 580;
            entity.targetY = 240;
            entity.x = 580;
            entity.y = 240;

            newLogs.push(`[${formatTime(currentClock)}] [INFO] [CONTROLLER] ${entity.name} completed entire processing pipeline in ${(currentClock - entity.arrivalTime).toFixed(2)}s`);

            // Trigger next queued item on Laser
            processQueue(res, "laser", "LaserComplete", currentClock, localEntities, localEvents, newLogs);
          }
        }
      }

      // Update positions of entities for smooth animation on SVG
      localEntities = localEntities.map(ent => {
        let coords = getStageCoordinates(ent.currentStage, ent.status, getQueueIndex(ent.id, ent.currentStage, localResources));
        return {
          ...ent,
          targetX: coords.x,
          targetY: coords.y,
          // Animate fractionally
          x: ent.x + (coords.x - ent.x) * 0.4,
          y: ent.y + (coords.y - ent.y) * 0.4,
        };
      });

      // Recalculate resource utilization rates dynamically
      Object.keys(localResources).forEach(key => {
        const res = localResources[key];
        let currentBusy = res.occupiedBy ? (nextClockTime - (localEntities.find(e => e.id === res.occupiedBy)?.startTime || nextClockTime)) : 0;
        const busyAccrued = res.totalBusyTime + Math.max(0, currentBusy);
        res.utilization = nextClockTime > 0 ? Math.min(100.0, (busyAccrued / nextClockTime) * 100) : 0;
      });

      // Update React State
      setClockTime(nextClockTime);
      if (stepIncrement > 0) {
        setStepCount(prev => prev + stepIncrement);
      }
      setEntities(localEntities);
      setFutureEvents(localEvents);
      setResources(localResources);
      if (newLogs.length > 0) {
        setLogs(prev => [...prev, ...newLogs]);
      }

    }, intervalPeriod);

    return () => clearInterval(timer);
  }, [simState]);

  // Helper: Route entity to a specific resource stage
  const routeEntityToResource = (
    entity: SimEntity,
    resourceKey: "lathe" | "cnc" | "laser",
    currentTime: number,
    localEntities: SimEntity[],
    localResources: Record<string, SimResource>,
    localEvents: SimEvent[],
    newLogs: string[]
  ) => {
    const res = localResources[resourceKey];
    entity.status = "Queued";
    
    if (resourceKey === "lathe") entity.currentStage = 1;
    else if (resourceKey === "cnc") entity.currentStage = 2;
    else if (resourceKey === "laser") entity.currentStage = 3;

    if (res.occupiedBy === null) {
      // Resource is idle: Acquire immediately
      res.occupiedBy = entity.id;
      entity.status = "InService";
      entity.startTime = currentTime;

      // Define standard service durations (deterministic but unique per stage)
      const serviceDuration = resourceKey === "lathe" ? 8.0 : resourceKey === "cnc" ? 10.0 : 6.0;
      const completeType = resourceKey === "lathe" ? "LatheComplete" : resourceKey === "cnc" ? "CNCComplete" : "LaserComplete";

      localEvents.push({
        id: `evt_comp_${entity.id}_${resourceKey}`,
        time: currentTime + serviceDuration,
        type: completeType as any,
        entityId: entity.id,
        priority: 2
      });

      newLogs.push(`[${formatTime(currentTime)}] [INFO] [RESOURCE] ${res.name}: TryAcquire(${entity.name}) -> SUCCESS (Available: 0)`);
    } else {
      // Resource is busy: Queue up
      res.queue.push(entity.id);
      newLogs.push(`[${formatTime(currentTime)}] [INFO] [RESOURCE] ${res.name}: TryAcquire(${entity.name}) -> QUEUED (WaitQueue Count: ${res.queue.length})`);
    }
  };

  // Helper: Process queue once resource becomes idle
  const processQueue = (
    res: SimResource,
    resourceKey: "lathe" | "cnc" | "laser",
    eventType: "LatheComplete" | "CNCComplete" | "LaserComplete",
    currentTime: number,
    localEntities: SimEntity[],
    localEvents: SimEvent[],
    newLogs: string[]
  ) => {
    if (res.queue.length > 0) {
      const nextId = res.queue.shift()!;
      const nextEntity = localEntities.find(e => e.id === nextId);
      if (nextEntity) {
        res.occupiedBy = nextId;
        nextEntity.status = "InService";
        nextEntity.startTime = currentTime;

        const serviceDuration = resourceKey === "lathe" ? 8.0 : resourceKey === "cnc" ? 10.0 : 6.0;
        localEvents.push({
          id: `evt_comp_${nextId}_${resourceKey}`,
          time: currentTime + serviceDuration,
          type: eventType as any,
          entityId: nextId,
          priority: 2
        });

        newLogs.push(`[${formatTime(currentTime)}] [INFO] [RESOURCE] ${res.name}: Queue Release -> ${nextEntity.name} unblocked & acquiring (Available: 0)`);
      }
    }
  };

  // Get index in resource queue
  const getQueueIndex = (entityId: string, stage: number, localResources: Record<string, SimResource>) => {
    let rKey = stage === 1 ? "lathe" : stage === 2 ? "cnc" : stage === 3 ? "laser" : "";
    if (!rKey) return 0;
    return localResources[rKey]?.queue.indexOf(entityId) ?? 0;
  };

  // Layout coordinate mappings for smooth animations
  const getStageCoordinates = (stage: number, status: "Arrived" | "Queued" | "InService" | "Completed", queueIdx: number) => {
    if (stage === 0) { // Arrival / Loading
      return { x: 50, y: 150 };
    }
    if (stage === 1) { // Lathe Machine Stage
      if (status === "Queued") {
        return { x: 130 - (queueIdx * 20), y: 110 };
      }
      return { x: 180, y: 110 };
    }
    if (stage === 2) { // CNC Router Stage
      if (status === "Queued") {
        return { x: 270 - (queueIdx * 20), y: 190 };
      }
      return { x: 320, y: 190 };
    }
    if (stage === 3) { // Laser Cutter Stage
      if (status === "Queued") {
        return { x: 410 - (queueIdx * 20), y: 270 };
      }
      return { x: 460, y: 270 };
    }
    // Completed state
    return { x: 550, y: 190 + (Math.sin(queueIdx) * 30) };
  };

  // Human-readable sim timer parser (00:00.00)
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const millis = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  // Simulation Controls trigger handlers
  const handleStart = () => {
    if (simState === "Completed") {
      handleReset();
    }
    setSimState("Running");
    setLogs(prev => [...prev, `[${formatTime(clockTime)}] [INFO] [CONTROLLER] State transition: '${simState}' ===> 'Running'`]);
  };

  const handlePause = () => {
    setSimState("Paused");
    setLogs(prev => [...prev, `[${formatTime(clockTime)}] [WARN] [CONTROLLER] Simulation paused. Clock frozen. State transition: 'Running' ===> 'Paused'`]);
  };

  const handleStop = () => {
    setSimState("Stopped");
    setLogs(prev => [
      ...prev,
      `[${formatTime(clockTime)}] [WARN] [CONTROLLER] Suspending simulation pipeline. Halting active services...`,
      `[${formatTime(clockTime)}] [INFO] [CONTROLLER] State transition: '${simState}' ===> 'Stopped'`
    ]);
  };

  const handleStep = () => {
    // Single discrete-event step algorithm
    const current = stateRef.current;
    if (current.futureEvents.length === 0) {
      setSimState("Completed");
      setLogs(prev => [...prev, `[${formatTime(current.clockTime)}] [INFO] [CONTROLLER] Future Event List (FEL) empty. Simulation finished.`]);
      return;
    }

    // Dequeue next chronological event
    let sortedEvents = [...current.futureEvents].sort((a, b) => a.time - b.time || a.priority - b.priority);
    const nextEvent = sortedEvents[0];
    
    // Jump clock directly to the next event time
    const nextClockTime = Math.min(nextEvent.time, current.endTime);

    // Update state to Paused
    setSimState("Paused");

    // We trigger the state update manually for step
    let localEntities = [...current.entities];
    let localEvents = current.futureEvents.filter(e => e.id !== nextEvent.id);
    let localResources = JSON.parse(JSON.stringify(current.resources)) as Record<string, SimResource>;
    const newLogs: string[] = [];

    // Process event
    const currentClock = nextClockTime;

    if (nextEvent.type === "Arrival") {
      const entityId = nextEvent.entityId;
      const entityIdx = parseInt(entityId.split("_")[1]) || 1;
      const entityTypes = ["Titanium Axle", "Aluminium Bracket", "Steel Impeller", "Brass Gear"];
      const colors = ["#818cf8", "#34d399", "#f59e0b", "#f43f5e"];
      const typeStr = entityTypes[(entityIdx - 1) % entityTypes.length];
      const colorStr = colors[(entityIdx - 1) % colors.length];

      const newEntity: SimEntity = {
        id: entityId,
        name: `Part ${entityIdx}`,
        type: typeStr,
        status: "Arrived",
        currentStage: 0,
        color: colorStr,
        x: 40,
        y: 80,
        targetX: 80,
        targetY: 150,
        arrivalTime: currentClock
      };
      localEntities.push(newEntity);
      newLogs.push(`[${formatTime(currentClock)}] [INFO] [DISPATCHER] STEP: Processing event 'Arrival' for ${newEntity.name}`);
      
      routeEntityToResource(newEntity, "lathe", currentClock, localEntities, localResources, localEvents, newLogs);

      const nextArrivalTime = currentClock + current.arrivalInterval;
      localEvents.push({
        id: `evt_arr_${entityIdx + 1}`,
        time: nextArrivalTime,
        type: "Arrival",
        entityId: `part_${entityIdx + 1}`,
        priority: 1
      });
    }
    else if (nextEvent.type === "LatheComplete") {
      const entity = localEntities.find(e => e.id === nextEvent.entityId);
      if (entity) {
        newLogs.push(`[${formatTime(currentClock)}] [PASS] STEP: Completed Lathe operations for ${entity.name}`);
        const res = localResources.lathe;
        res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
        res.occupiedBy = null;
        entity.currentStage = 2;
        routeEntityToResource(entity, "cnc", currentClock, localEntities, localResources, localEvents, newLogs);
        processQueue(res, "lathe", "LatheComplete", currentClock, localEntities, localEvents, newLogs);
      }
    }
    else if (nextEvent.type === "CNCComplete") {
      const entity = localEntities.find(e => e.id === nextEvent.entityId);
      if (entity) {
        newLogs.push(`[${formatTime(currentClock)}] [PASS] STEP: Completed CNC Router carving for ${entity.name}`);
        const res = localResources.cnc;
        res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
        res.occupiedBy = null;
        entity.currentStage = 3;
        routeEntityToResource(entity, "laser", currentClock, localEntities, localResources, localEvents, newLogs);
        processQueue(res, "cnc", "CNCComplete", currentClock, localEntities, localEvents, newLogs);
      }
    }
    else if (nextEvent.type === "LaserComplete") {
      const entity = localEntities.find(e => e.id === nextEvent.entityId);
      if (entity) {
        newLogs.push(`[${formatTime(currentClock)}] [PASS] STEP: Completed Laser engraving for ${entity.name}`);
        const res = localResources.laser;
        res.totalBusyTime += (currentClock - (entity.startTime || currentClock));
        res.occupiedBy = null;
        entity.status = "Completed";
        entity.currentStage = 4;
        entity.completionTime = currentClock;
        entity.x = 580;
        entity.y = 240;
        newLogs.push(`[${formatTime(currentClock)}] [INFO] [CONTROLLER] ${entity.name} completed pipeline.`);
        processQueue(res, "laser", "LaserComplete", currentClock, localEntities, localEvents, newLogs);
      }
    }

    // Dynamic utilization updates
    Object.keys(localResources).forEach(key => {
      const res = localResources[key];
      let currentBusy = res.occupiedBy ? (nextClockTime - (localEntities.find(e => e.id === res.occupiedBy)?.startTime || nextClockTime)) : 0;
      const busyAccrued = res.totalBusyTime + Math.max(0, currentBusy);
      res.utilization = nextClockTime > 0 ? Math.min(100.0, (busyAccrued / nextClockTime) * 100) : 0;
    });

    // Sync rendering coordinates
    localEntities = localEntities.map(ent => {
      let coords = getStageCoordinates(ent.currentStage, ent.status, getQueueIndex(ent.id, ent.currentStage, localResources));
      return { ...ent, x: coords.x, y: coords.y, targetX: coords.x, targetY: coords.y };
    });

    setClockTime(nextClockTime);
    setStepCount(prev => prev + 1);
    setEntities(localEntities);
    setFutureEvents(localEvents);
    setResources(localResources);
    setLogs(prev => [...prev, ...newLogs]);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* OS Desktop Window Frame Wrapper (Simulation client) */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Windows Chrome Head Bar */}
        <div className="bg-slate-950 border-b border-slate-900 px-4 py-2.5 flex items-center justify-between select-none">
          {/* OS-styled Window Controls */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors inline-block cursor-pointer"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors inline-block cursor-pointer"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors inline-block cursor-pointer"></span>
            </div>
            <span className="h-4 w-px bg-slate-800 ml-2"></span>
            <span className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-1.5 ml-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              NovaSim Desktop Client - Avalonia UI v1.0.0
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 font-bold">
              Avalonia Client
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
              Active Session
            </span>
          </div>
        </div>

        {/* Client App Menu Bar */}
        <div className="bg-slate-900/50 border-b border-slate-950 px-4 py-1.5 flex items-center gap-4 text-[11px] font-mono text-slate-400 select-none">
          {["File", "Simulation", "Diagnostics", "Window", "Help"].map((m, i) => (
            <span key={i} className="hover:text-slate-100 cursor-pointer px-1 py-0.5 hover:bg-slate-800 rounded transition-all">{m}</span>
          ))}
        </div>

        {/* Primary Desktop Area Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#0a0f1d] min-h-[440px]">
          
          {/* Desktop Left Sidebar: Parameter Inputs & Setup */}
          <div className="lg:col-span-3 border-r border-slate-900 p-4 space-y-4 bg-slate-950/40">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-900">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Simulation Setup
              </h4>
            </div>

            <div className="space-y-3 font-mono text-[11px]">
              {/* Parameter: EndTime */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Simulation EndTime:</span>
                  <span className="text-indigo-400 font-bold">{endTime.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="300"
                  step="10"
                  value={endTime}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                  disabled={simState === "Running" || simState === "Paused"}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg outline-none"
                />
              </div>

              {/* Parameter: Mean Arrival Interval */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Arrival Interval (Mean):</span>
                  <span className="text-indigo-400 font-bold">{arrivalInterval.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1.0"
                  value={arrivalInterval}
                  onChange={(e) => setArrivalInterval(Number(e.target.value))}
                  disabled={simState === "Running" || simState === "Paused"}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg outline-none"
                />
              </div>

              {/* Parameter: Seed */}
              <div className="space-y-1">
                <label className="text-slate-400 block">Random Generator Seed:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={simState === "Running" || simState === "Paused"}
                    className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:border-indigo-500 rounded px-2.5 py-1 text-slate-200"
                  />
                  <button
                    onClick={() => setSeed(Math.floor(Math.random() * 100) + 1)}
                    disabled={simState === "Running" || simState === "Paused"}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-800 px-2 py-1 text-[10px] text-slate-400 rounded transition-all"
                    title="Generate Seed"
                  >
                    Gen
                  </button>
                </div>
              </div>

              {/* Engine Config: Time Scale multiplier */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Clock Speed Scale:</span>
                  <span className="text-emerald-400 font-bold">{simSpeed.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1.0, 2.0, 4.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setSimSpeed(v)}
                      className={`py-0.5 text-[10px] rounded border transition-all ${
                        simSpeed === v
                          ? "bg-indigo-950/30 border-indigo-500 text-indigo-400 font-bold"
                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Hardware / Engine Profile Status indicators */}
              <div className="pt-3 border-t border-slate-900 space-y-1.5 text-[10px] text-slate-500">
                <div className="flex justify-between">
                  <span>Solver Architecture:</span>
                  <span className="text-slate-400">Discrete-Event FEL</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Engine:</span>
                  <span className="text-slate-400">SQLite (In-Memory)</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Workers:</span>
                  <span className="text-emerald-400 font-bold">1 Core Thread</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Core Canvas & Controller Layout */}
          <div className="lg:col-span-6 flex flex-col justify-between border-r border-slate-900">
            
            {/* Visualizer Canvas Area */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              
              <div className="flex justify-between items-center mb-2 font-mono">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Manufacturing Line Viewport
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  WebGL Engine Render
                </span>
              </div>

              {/* Dynamic SVG canvas drawing stages */}
              <div className="relative w-full aspect-[16/9] bg-[#030610] rounded-xl border border-slate-900 overflow-hidden flex items-center justify-center">
                
                {/* SVG Visualizations of manufacturing stages */}
                <svg className="w-full h-full" viewBox="0 0 600 300">
                  {/* Grid backing lines */}
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  {/* Flow pipeline lines */}
                  <path d="M 50 150 L 180 110 M 180 110 L 320 190 M 320 190 L 460 270 M 460 270 L 550 190" fill="none" stroke="#1e1b4b" strokeWidth="3" strokeDasharray="5,5" />

                  {/* Loading/Arrival dock */}
                  <rect x="25" y="125" width="50" height="50" rx="8" fill="#0c1126" stroke="#4338ca" strokeWidth="1.5" />
                  <text x="50" y="145" textAnchor="middle" fill="#818cf8" fontSize="10" fontWeight="bold" fontFamily="monospace">LOAD</text>
                  <text x="50" y="162" textAnchor="middle" fill="#6366f1" fontSize="8" fontFamily="monospace">DOCK</text>

                  {/* Stage 1: Lathe Machine Machine */}
                  <rect x="150" y="85" width="60" height="50" rx="10" fill="#0c1d1a" stroke={resources.lathe.occupiedBy ? "#10b981" : "#1f2937"} strokeWidth="1.5" className="transition-all duration-300" />
                  <text x="180" y="105" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold" fontFamily="monospace">LATHE</text>
                  <text x="180" y="122" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="monospace">STAGE 1</text>
                  {/* Busy indicator */}
                  {resources.lathe.occupiedBy && (
                    <circle cx="180" cy="70" r="4" fill="#10b981" className="animate-pulse" />
                  )}

                  {/* Stage 2: CNC Router */}
                  <rect x="290" y="165" width="60" height="50" rx="10" fill="#1e1b4b" stroke={resources.cnc.occupiedBy ? "#818cf8" : "#1f2937"} strokeWidth="1.5" className="transition-all duration-300" />
                  <text x="320" y="185" textAnchor="middle" fill="#818cf8" fontSize="10" fontWeight="bold" fontFamily="monospace">CNC</text>
                  <text x="320" y="202" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="monospace">STAGE 2</text>
                  {/* Busy indicator */}
                  {resources.cnc.occupiedBy && (
                    <circle cx="320" cy="150" r="4" fill="#818cf8" className="animate-pulse" />
                  )}

                  {/* Stage 3: Laser Engraver */}
                  <rect x="430" y="245" width="60" height="50" rx="10" fill="#2e0f1d" stroke={resources.laser.occupiedBy ? "#f43f5e" : "#1f2937"} strokeWidth="1.5" className="transition-all duration-300" />
                  <text x="460" y="265" textAnchor="middle" fill="#f43f5e" fontSize="10" fontWeight="bold" fontFamily="monospace">LASER</text>
                  <text x="460" y="282" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="monospace">STAGE 3</text>
                  {/* Busy indicator */}
                  {resources.laser.occupiedBy && (
                    <circle cx="460" cy="230" r="4" fill="#f43f5e" className="animate-pulse" />
                  )}

                  {/* Exit Store dock */}
                  <rect x="525" y="165" width="50" height="50" rx="8" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                  <text x="550" y="185" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="bold" fontFamily="monospace">FINISHED</text>
                  <text x="550" y="202" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">STORE</text>

                  {/* Queue lines for machines */}
                  {/* Lathe waiting line label */}
                  <text x="130" y="125" textAnchor="end" fill="#4b5563" fontSize="8" fontFamily="monospace">Wait Q</text>
                  {/* CNC waiting line label */}
                  <text x="270" y="205" textAnchor="end" fill="#4b5563" fontSize="8" fontFamily="monospace">Wait Q</text>
                  {/* Laser waiting line label */}
                  <text x="410" y="285" textAnchor="end" fill="#4b5563" fontSize="8" fontFamily="monospace">Wait Q</text>

                  {/* Render simulated active entities (Parts) */}
                  {entities.map((entity) => {
                    // Hide completed after a few seconds of animation
                    if (entity.status === "Completed" && clockTime - (entity.completionTime || 0) > 6.0) return null;

                    return (
                      <g key={entity.id} className="transition-all duration-100">
                        {/* Pulse circle mapping entity position */}
                        <circle cx={entity.x} cy={entity.y} r="8" fill={entity.color} stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
                        {/* Text label mapping */}
                        <text x={entity.x} y={entity.y - 12} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold" fontFamily="monospace" className="select-none pointer-events-none">
                          P{entity.id.split("_")[1]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Status Overlay in Top-Right Corner */}
                <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur border border-slate-900 rounded px-2.5 py-1 text-[9px] font-mono flex items-center gap-2">
                  <span className="text-slate-500">ACTIVE:</span>
                  <span className="text-indigo-400 font-bold">{entities.filter(e => e.status !== "Completed").length} Entities</span>
                </div>
              </div>
            </div>

            {/* Controller Toolbar Section: Start, Pause, Stop, Reset, Step */}
            <div className="bg-slate-950 border-t border-slate-900 p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  {/* PLAY button */}
                  <button
                    onClick={handleStart}
                    disabled={simState === "Running" || simState === "Completed"}
                    className="flex items-center justify-center p-2 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all disabled:opacity-30 disabled:pointer-events-none shadow"
                    title="Start Simulation Clock"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  {/* PAUSE button */}
                  <button
                    onClick={handlePause}
                    disabled={simState !== "Running"}
                    className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    title="Pause Simulation"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                  </button>

                  {/* STOP button */}
                  <button
                    onClick={handleStop}
                    disabled={simState !== "Running" && simState !== "Paused"}
                    className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    title="Stop Simulation"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>

                  {/* STEP button */}
                  <button
                    onClick={handleStep}
                    disabled={simState === "Running" || simState === "Completed"}
                    className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    title="Step to Next Future Event"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* RESET button */}
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Reset Simulation Clock"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="font-mono text-right shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">Processed events</div>
                  <div className="text-sm font-bold text-slate-300">{stepCount} ticks</div>
                </div>
              </div>
            </div>

          </div>

          {/* Desktop Right Sidebar: Clock & Resources utilization and event lists */}
          <div className="lg:col-span-3 p-4 bg-slate-950/40 space-y-4 flex flex-col justify-between">
            
            <div className="space-y-4 flex-1">
              {/* Simulation Clock & App Status Badge */}
              <div className="bg-[#040813] border border-slate-900 rounded-xl p-3 space-y-2.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase">System status</span>
                  {/* Colored status indicator */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                    simState === "Running"
                      ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/30 animate-pulse"
                      : simState === "Paused"
                      ? "text-amber-400 bg-amber-950/20 border-amber-900/30"
                      : simState === "Completed"
                      ? "text-indigo-400 bg-indigo-950/20 border-indigo-900/30"
                      : "text-slate-400 bg-slate-900 border-slate-800"
                  }`}>
                    {simState}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Simulation Clock Time
                  </span>
                  <div className="text-xl font-extrabold text-slate-100 tabular-nums">
                    {formatTime(clockTime)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-900/80 pt-2 text-slate-500">
                  <div>
                    <span>Progress:</span>
                    <div className="text-slate-300 font-bold">{((clockTime / endTime) * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <span>Active events:</span>
                    <div className="text-indigo-400 font-bold">{futureEvents.length} FEL</div>
                  </div>
                </div>
              </div>

              {/* Resource Utilization trackers */}
              <div className="space-y-3 font-mono">
                <div className="flex items-center gap-1.5 text-slate-400 pb-1 border-b border-slate-900">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">
                    Resource Analytics
                  </h4>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  {(Object.values(resources) as SimResource[]).map((res) => (
                    <div key={res.id} className="space-y-1 bg-slate-900/10 p-2.5 rounded-lg border border-slate-900/60">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="font-bold truncate max-w-[110px]">{res.name.split(" (")[0]}</span>
                        <span className="text-emerald-400 font-bold">{res.utilization.toFixed(1)}%</span>
                      </div>
                      
                      {/* Utilization slider bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300"
                          style={{ width: `${res.utilization}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[9px] text-slate-500 pt-0.5">
                        <span>Queue count: <strong className="text-slate-300">{res.queue.length}</strong></span>
                        <span className="uppercase">
                          {res.occupiedBy ? "Busy" : "Idle"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* FEL Queue Status (Upcoming timeline events) */}
            <div className="mt-4 pt-3 border-t border-slate-900 font-mono text-[10px] text-slate-500 space-y-1.5 flex-none">
              <div className="flex justify-between items-center pb-1">
                <span className="uppercase font-bold text-slate-400 text-[9px]">Future Event List (FEL) Queue</span>
                <span className="text-indigo-400 font-semibold">{futureEvents.length} scheduled</span>
              </div>
              <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
                {futureEvents
                  .sort((a, b) => a.time - b.time)
                  .slice(0, 3)
                  .map((evt, index) => (
                    <div key={evt.id} className="flex justify-between bg-slate-900/40 border border-slate-900 p-1 px-2 rounded">
                      <span className="text-slate-400 font-bold">
                        {index + 1}. {evt.type} (P{evt.entityId.split("_")[1]})
                      </span>
                      <span className="text-indigo-400">t = {evt.time.toFixed(1)}s</span>
                    </div>
                  ))}
                {futureEvents.length === 0 && (
                  <div className="text-center italic text-slate-600">FEL queue empty.</div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Activity terminal log mapping at the very bottom */}
        <div className="bg-slate-950/80 border-t border-slate-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              SOLVER DIAGNOSTICS & SYSTEM EVENT FEED
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-[9px] font-mono text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800"
            >
              Flush Logs
            </button>
          </div>
          <div className="h-28 overflow-y-auto bg-[#03060a] border border-slate-900 rounded-lg p-3 space-y-1.5 font-mono text-[10px] text-slate-400">
            {logs.map((log, index) => {
              let textClass = "text-slate-400";
              if (log.includes("[PASS]")) textClass = "text-emerald-400 font-bold";
              else if (log.includes("[WARN]")) textClass = "text-amber-400";
              else if (log.includes("[DISPATCHER]")) textClass = "text-indigo-400";
              else if (log.includes("[RESOURCE]")) textClass = "text-sky-400";

              return (
                <div key={index} className={`leading-normal flex gap-2 ${textClass}`}>
                  <span className="text-slate-600 shrink-0 select-none">▶</span>
                  <span className="break-all font-mono">{log}</span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
