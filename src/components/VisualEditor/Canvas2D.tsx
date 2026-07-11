import React, { useState, useRef, useEffect, useMemo } from "react";
import { SimNode, SimConnection, NodeType } from "../../core/simulation/types";
import {
  Plus,
  Trash2,
  GitCommit,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Grid,
  Maximize,
  Minimize,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  Clipboard,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  X,
  Check
} from "lucide-react";

interface Canvas2DProps {
  nodes: SimNode[];
  connections: SimConnection[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  selectedConnectionId?: string | null;
  onSelectConnection?: (id: string | null) => void;
  onUpdateNodeCoords: (id: string, x: number, y: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  activeEntityLocations: Record<string, string>;
  onUpdateLayout?: (nodes: SimNode[], connections: SimConnection[]) => void;
}

// Custom layer structure
interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export default function Canvas2D({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  selectedConnectionId = null,
  onSelectConnection,
  onUpdateNodeCoords,
  onAddConnection,
  onDeleteNode,
  onDeleteConnection,
  activeEntityLocations,
  onUpdateLayout
}: Canvas2DProps) {
  // --- Viewport State (Infinite Canvas) ---
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 50, y: 50 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 520 });

  // --- Selection State (Multi-selection) ---
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // --- Grid and Snapping ---
  const [snapSize, setSnapSize] = useState<number>(10); // 1, 5, 10, 20, 50, or 0 (off)
  const [showGrid, setShowGrid] = useState(true);

  // --- Layer Management ---
  const [layers, setLayers] = useState<CanvasLayer[]>([
    { id: "default", name: "Core Layer", visible: true, locked: false },
    { id: "equipment", name: "Heavy Equipment", visible: true, locked: false },
    { id: "logistics", name: "Logistics Paths", visible: true, locked: false },
    { id: "annotations", name: "System Labels", visible: true, locked: false }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("default");
  const [showLayerWidget, setShowLayerWidget] = useState(false);

  // --- Local History Stack (Undo/Redo) ---
  const [historyPast, setHistoryPast] = useState<{ nodes: SimNode[]; connections: SimConnection[] }[]>([]);
  const [historyFuture, setHistoryFuture] = useState<{ nodes: SimNode[]; connections: SimConnection[] }[]>([]);

  // --- Clipboard ---
  const [clipboard, setClipboard] = useState<{
    nodes: SimNode[];
    connections: SimConnection[];
  } | null>(null);

  // --- Connection-drawing State ---
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [draggingConnectionSourceId, setDraggingConnectionSourceId] = useState<string | null>(null);
  const [draggingConnectionPos, setDraggingConnectionPos] = useState<{ x: number; y: number } | null>(null);
  const [draggingConnectionTargetId, setDraggingConnectionTargetId] = useState<string | null>(null);
  const [reconnectingConnectionId, setReconnectingConnectionId] = useState<string | null>(null);

  // Math helper for rotating a point around a center of rotation
  const getRotatedPoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
    if (!angleDeg) return { x, y };
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  };

  const getInputPortCoords = (node: SimNode) => {
    const w = node.properties.width || 140;
    const h = node.properties.height || 52;
    const rot = node.properties.rotation || 0;
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;
    return getRotatedPoint(node.x, node.y + h / 2, cx, cy, rot);
  };

  const getOutputPortCoords = (node: SimNode) => {
    const w = node.properties.width || 140;
    const h = node.properties.height || 52;
    const rot = node.properties.rotation || 0;
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;
    return getRotatedPoint(node.x + w, node.y + h / 2, cx, cy, rot);
  };

  const getConnectionPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    style: "bezier" | "orthogonal" | "straight" = "bezier"
  ) => {
    if (style === "straight") {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    if (style === "orthogonal") {
      const midX = startX + (endX - startX) * 0.5;
      return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    }
    // bezier
    const cp1x = startX + Math.abs(endX - startX) * 0.5;
    const cp2x = endX - Math.abs(endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
  };

  const getMidpoint = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    style: "bezier" | "orthogonal" | "straight" = "bezier"
  ) => {
    if (style === "orthogonal") {
      return {
        x: startX + (endX - startX) * 0.5,
        y: (startY + endY) * 0.5
      };
    }
    return {
      x: (startX + endX) * 0.5,
      y: (startY + endY) * 0.5
    };
  };

  // --- Dragging & Interactive States ---
  const [dragMode, setDragMode] = useState<"select" | "pan" | "marquee" | "node-drag">("select");
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);

  // Marquee Selection Box State
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  const [isDrawingMarquee, setIsDrawingMarquee] = useState(false);

  // Panning drag state
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Drag offsets
  const [draggingNodesStartCoords, setDraggingNodesStartCoords] = useState<{ id: string; x: number; y: number }[]>([]);
  const [dragMouseStart, setDragMouseStart] = useState({ x: 0, y: 0 });
  const [isNodeDraggingActive, setIsNodeDraggingActive] = useState(false);

  // Resizing / Rotating interactive state
  const [isResizingActive, setIsResizingActive] = useState(false);
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState({ width: 140, height: 52 });

  const [isRotatingActive, setIsRotatingActive] = useState(false);
  const [rotatingNodeId, setRotatingNodeId] = useState<string | null>(null);
  const [rotateStartAngle, setRotateStartAngle] = useState(0);
  const [rotateCenter, setRotateCenter] = useState({ x: 0, y: 0 });

  // --- UI Overlays State ---
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: "canvas" | "node" | "wire";
    targetId: string | null;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selectedNodeIds with single selectedNodeId from parent props
  useEffect(() => {
    if (selectedNodeId) {
      if (!selectedNodeIds.includes(selectedNodeId)) {
        setSelectedNodeIds([selectedNodeId]);
      }
      setSelectedConnectionIds([]); // clear connection selections
    } else {
      setSelectedNodeIds([]);
    }
  }, [selectedNodeId]);

  // Sync selectedConnectionIds with selectedConnectionId from parent props
  useEffect(() => {
    if (selectedConnectionId) {
      if (!selectedConnectionIds.includes(selectedConnectionId)) {
        setSelectedConnectionIds([selectedConnectionId]);
      }
      setSelectedNodeIds([]); // clear node selections
    } else {
      setSelectedConnectionIds([]);
    }
  }, [selectedConnectionId]);

  // Track Container resizing to adjust viewport culling and minimap viewport
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- History Push Helpers ---
  const pushHistorySnapshot = (currentNodes = nodes, currentConns = connections) => {
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      connections: JSON.parse(JSON.stringify(currentConns))
    };
    setHistoryPast((prev) => [...prev.slice(-39), snapshot]); // limit 40
    setHistoryFuture([]); // clear redo
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, historyPast.length - 1);
    
    const currentSnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections))
    };

    setHistoryPast(newPast);
    setHistoryFuture((prev) => [currentSnapshot, ...prev]);

    if (onUpdateLayout) {
      onUpdateLayout(previous.nodes, previous.connections);
    }
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);

    const currentSnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections))
    };

    setHistoryPast((prev) => [...prev, currentSnapshot]);
    setHistoryFuture(newFuture);

    if (onUpdateLayout) {
      onUpdateLayout(next.nodes, next.connections);
    }
  };

  // --- Snapping helper ---
  const snapValue = (val: number): number => {
    if (snapSize <= 0) return val;
    return Math.round(val / snapSize) * snapSize;
  };

  // --- Coordinates Conversion ---
  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom
    };
  };

  // --- Layers & Locking filter Helpers ---
  const isNodeSelectable = (node: SimNode) => {
    // Determine layer
    const layerTag = (node as any).layer || "default";
    const layer = layers.find((l) => l.id === layerTag);
    if (layer && !layer.visible) return false;
    if (layer && layer.locked) return false;
    return true;
  };

  const activeNodes = useMemo(() => {
    return nodes.filter((node) => {
      const layerTag = (node as any).layer || "default";
      const layer = layers.find((l) => l.id === layerTag);
      return layer ? layer.visible : true;
    });
  }, [nodes, layers]);

  const activeConnections = useMemo(() => {
    const nodeIds = new Set(activeNodes.map((n) => n.id));
    return connections.filter((conn) => nodeIds.has(conn.sourceId) && nodeIds.has(conn.targetId));
  }, [connections, activeNodes]);

  // --- Viewport Frustum Culling calculation ---
  const visibleNodes = useMemo(() => {
    const minX = -panOffset.x / zoom - 200;
    const maxX = (-panOffset.x + containerSize.width) / zoom + 200;
    const minY = -panOffset.y / zoom - 200;
    const maxY = (-panOffset.y + containerSize.height) / zoom + 200;

    return activeNodes.filter((node) => {
      // Cull out nodes that are completely outside the visible canvas bounds
      return node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
    });
  }, [activeNodes, panOffset, zoom, containerSize]);

  // --- Keyboard Shortcuts Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing shortcuts when writing in properties panel, inputs, or copilot textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.code === "Space") {
        setIsSpacePressed(true);
        if (dragMode === "select") setDragMode("pan");
        e.preventDefault();
      }

      // Deselect or Link Cancel
      if (e.key === "Escape") {
        setSelectedNodeIds([]);
        onSelectNode(null);
        setLinkingSourceId(null);
        setIsDrawingMarquee(false);
        setContextMenu(null);
      }

      // Select All
      if (ctrlKey && e.key === "a") {
        e.preventDefault();
        const selectableIds = activeNodes.filter(isNodeSelectable).map((n) => n.id);
        setSelectedNodeIds(selectableIds);
        if (selectableIds.length > 0) {
          onSelectNode(selectableIds[selectableIds.length - 1]);
        }
      }

      // Undo / Redo
      if (ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
      if (ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        handleRedo();
      }

      // Copy / Cut / Paste
      if (ctrlKey && e.key === "c") {
        e.preventDefault();
        handleCopyAction();
      }
      if (ctrlKey && e.key === "x") {
        e.preventDefault();
        handleCutAction();
      }
      if (ctrlKey && e.key === "v") {
        e.preventDefault();
        handlePasteAction();
      }

      // Delete Selected Nodes / Connections
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.length > 0 || selectedConnectionIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      // Nudging selected items with Arrow keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const offsetDist = e.shiftKey ? 1 : (snapSize > 0 ? snapSize : 5);
        let dx = 0, dy = 0;
        if (e.key === "ArrowUp") dy = -offsetDist;
        if (e.key === "ArrowDown") dy = offsetDist;
        if (e.key === "ArrowLeft") dx = -offsetDist;
        if (e.key === "ArrowRight") dx = offsetDist;

        if (selectedNodeIds.length > 0) {
          pushHistorySnapshot();
          const targetIds = new Set(selectedNodeIds);
          const updatedNodes = nodes.map((node) => {
            if (targetIds.has(node.id) && isNodeSelectable(node)) {
              return { ...node, x: node.x + dx, y: node.y + dy };
            }
            return node;
          });
          if (onUpdateLayout) {
            onUpdateLayout(updatedNodes, connections);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setDragMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeIds, nodes, connections, activeNodes, layers, clipboard, dragMode, snapSize]);

  // --- Clipboard Operations ---
  const handleCopyAction = () => {
    if (selectedNodeIds.length === 0) return;
    const copiedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const copiedConns = connections.filter(
      (c) => selectedNodeIds.includes(c.sourceId) && selectedNodeIds.includes(c.targetId)
    );
    setClipboard({ nodes: copiedNodes, connections: copiedConns });
  };

  const handleCutAction = () => {
    if (selectedNodeIds.length === 0) return;
    handleCopyAction();
    handleDeleteSelected();
  };

  const handlePasteAction = (pasteScreenCoords?: { x: number; y: number }) => {
    if (!clipboard) return;
    pushHistorySnapshot();

    // Determine coordinate offset for pasting
    let dx = 40;
    let dy = 40;

    if (pasteScreenCoords) {
      // Paste exactly at the clicked canvas coordinate
      const canvasCoords = screenToCanvas(pasteScreenCoords.x, pasteScreenCoords.y);
      // Align pasted nodes around the center click point
      if (clipboard.nodes.length > 0) {
        const sumX = clipboard.nodes.reduce((acc, n) => acc + n.x, 0);
        const sumY = clipboard.nodes.reduce((acc, n) => acc + n.y, 0);
        const avgX = sumX / clipboard.nodes.length;
        const avgY = sumY / clipboard.nodes.length;
        dx = canvasCoords.x - avgX;
        dy = canvasCoords.y - avgY;
      }
    }

    // Generate new unique IDs and preserve relationships
    const idMap: Record<string, string> = {};
    const newNodes: SimNode[] = clipboard.nodes.map((node) => {
      const newId = `${node.type.slice(0, 3)}_${Math.floor(Math.random() * 100000)}`;
      idMap[node.id] = newId;
      return {
        ...node,
        id: newId,
        x: snapValue(node.x + dx),
        y: snapValue(node.y + dy),
        name: `${node.name} (Copy)`,
        layer: activeLayerId // assign to currently active edit layer
      };
    });

    const newConns: SimConnection[] = clipboard.connections.map((conn) => ({
      id: `conn_${Math.floor(Math.random() * 100000)}`,
      sourceId: idMap[conn.sourceId] || conn.sourceId,
      targetId: idMap[conn.targetId] || conn.targetId
    }));

    const finalNodes = [...nodes, ...newNodes];
    const finalConns = [...connections, ...newConns];

    if (onUpdateLayout) {
      onUpdateLayout(finalNodes, finalConns);
    }

    // Highlight pasted items
    const pastedIds = newNodes.map((n) => n.id);
    setSelectedNodeIds(pastedIds);
    if (pastedIds.length > 0) {
      onSelectNode(pastedIds[pastedIds.length - 1]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedNodeIds.length === 0 && selectedConnectionIds.length === 0) return;
    pushHistorySnapshot();

    const finalNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const finalConns = connections.filter(
      (c) => !selectedNodeIds.includes(c.sourceId) && 
             !selectedNodeIds.includes(c.targetId) && 
             !selectedConnectionIds.includes(c.id)
    );

    setSelectedNodeIds([]);
    setSelectedConnectionIds([]);
    onSelectNode(null);
    if (onSelectConnection) {
      onSelectConnection(null);
    }

    if (onUpdateLayout) {
      onUpdateLayout(finalNodes, finalConns);
    }
  };

  // --- Alignment and Distribution Functions ---
  const handleAlign = (type: "top" | "middle" | "bottom" | "left" | "center" | "right") => {
    if (selectedNodeIds.length < 2) return;
    pushHistorySnapshot();

    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id) && isNodeSelectable(n));
    if (selectedNodes.length === 0) return;

    let coords = selectedNodes.map((n) => ({ x: n.x, y: n.y }));
    const targetIds = new Set(selectedNodeIds);

    let updatedNodes = [...nodes];

    if (type === "top") {
      const minY = Math.min(...coords.map((c) => c.y));
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, y: minY } : n));
    } else if (type === "bottom") {
      const maxY = Math.max(...coords.map((c) => c.y));
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, y: maxY } : n));
    } else if (type === "left") {
      const minX = Math.min(...coords.map((c) => c.x));
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, x: minX } : n));
    } else if (type === "right") {
      const maxX = Math.max(...coords.map((c) => c.x));
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, x: maxX } : n));
    } else if (type === "center") {
      // horizontal center: average X coordinate
      const sumX = coords.reduce((acc, c) => acc + c.x, 0);
      const avgX = snapValue(sumX / coords.length);
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, x: avgX } : n));
    } else if (type === "middle") {
      // vertical middle: average Y coordinate
      const sumY = coords.reduce((acc, c) => acc + c.y, 0);
      const avgY = snapValue(sumY / coords.length);
      updatedNodes = nodes.map((n) => (targetIds.has(n.id) && isNodeSelectable(n) ? { ...n, y: avgY } : n));
    }

    if (onUpdateLayout) {
      onUpdateLayout(updatedNodes, connections);
    }
  };

  const handleDistribute = (axis: "h" | "v") => {
    if (selectedNodeIds.length < 3) return;
    pushHistorySnapshot();

    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id) && isNodeSelectable(n));
    const targetIds = new Set(selectedNodeIds);

    if (axis === "h") {
      // Sort nodes by X coordinate
      const sorted = [...selectedNodes].sort((a, b) => a.x - b.x);
      const firstX = sorted[0].x;
      const lastX = sorted[sorted.length - 1].x;
      const totalDist = lastX - firstX;
      const gap = totalDist / (sorted.length - 1);

      const updatedNodes = nodes.map((n) => {
        if (targetIds.has(n.id) && isNodeSelectable(n)) {
          const idx = sorted.findIndex((s) => s.id === n.id);
          return { ...n, x: snapValue(firstX + idx * gap) };
        }
        return n;
      });
      if (onUpdateLayout) onUpdateLayout(updatedNodes, connections);
    } else {
      // Distribute Vertically
      const sorted = [...selectedNodes].sort((a, b) => a.y - b.y);
      const firstY = sorted[0].y;
      const lastY = sorted[sorted.length - 1].y;
      const totalDist = lastY - firstY;
      const gap = totalDist / (sorted.length - 1);

      const updatedNodes = nodes.map((n) => {
        if (targetIds.has(n.id) && isNodeSelectable(n)) {
          const idx = sorted.findIndex((s) => s.id === n.id);
          return { ...n, y: snapValue(firstY + idx * gap) };
        }
        return n;
      });
      if (onUpdateLayout) onUpdateLayout(updatedNodes, connections);
    }
  };

  // --- HTML5 Drag & Drop ObjectLibrary Drop Zone handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain");
    if (!type) return;

    // Convert mouse position to canvas relative position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasCoords = screenToCanvas(e.clientX, e.clientY);
    const newX = snapValue(canvasCoords.x - 70); // centered node width is 140
    const newY = snapValue(canvasCoords.y - 26); // centered node height is 52

    pushHistorySnapshot();

    const newId = `${type.slice(0, 3)}_${Math.floor(Math.random() * 100000)}`;
    const newNode: SimNode = {
      id: newId,
      type: type as NodeType,
      name: `New ${type.toUpperCase()}`,
      x: newX,
      y: newY,
      properties: {
        color:
          type === "processor" ? "#6366f1" :
          type === "queue" ? "#eab308" :
          type === "source" ? "#10b981" :
          type === "sink" ? "#ef4444" :
          type === "conveyor" ? "#06b6d4" :
          type === "resource" ? "#a855f7" :
          type === "transporter" ? "#f97316" :
          type === "separator" ? "#ec4899" :
          type === "combiner" ? "#8b5cf6" : "#64748b",
        ...(type === "source" ? { arrivalInterval: 10, distribution: "exponential" } : {}),
        ...(type === "processor" ? { processingTime: 8, capacity: 1, distribution: "exponential" } : {}),
        ...(type === "queue" ? { capacity: 9999 } : {}),
        ...(type === "router" ? { routeProbability: 0.5 } : {}),
        ...(type === "conveyor" ? { conveyorSpeed: 1.0, conveyorLength: 10, capacity: 10 } : {}),
        ...(type === "resource" ? { resourceType: "Worker", quantity: 1 } : {}),
        ...(type === "transporter" ? { transporterSpeed: 2.0, transporterCapacity: 5 } : {}),
        ...(type === "separator" ? { separatorType: "split", separatorSplitRatio: 0.5 } : {}),
        ...(type === "combiner" ? { combinerType: "batch", combinerBatchSize: 2 } : {})
      }
    };
    (newNode as any).layer = activeLayerId;

    const updatedNodes = [...nodes, newNode];
    if (onUpdateLayout) {
      onUpdateLayout(updatedNodes, connections);
    }
    setSelectedNodeIds([newId]);
    onSelectNode(newId);
  };

  // --- Mouse Actions router (Pan, Marquee, Dragging Nodes) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1;
    const isRight = e.button === 2;
    const isLeft = e.button === 0;

    setContextMenu(null); // close context menu

    if (isMiddle) {
      setIsMiddleMouseDown(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    if (isRight) {
      setIsRightMouseDown(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    if (isLeft) {
      // Linking Node in progress? If link drawing and clicked empty, cancel link
      if (linkingSourceId) {
        setLinkingSourceId(null);
        return;
      }

      // If Spacebar is pressed, trigger Pan mode
      if (isSpacePressed || dragMode === "pan") {
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Otherwise click on empty space: start Marquee selection
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setMarqueeStart(canvasCoords);
      setMarqueeEnd(canvasCoords);
      setIsDrawingMarquee(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Panning operations
    const isPanningActive =
      isSpacePressed || isMiddleMouseDown || isRightMouseDown || dragMode === "pan";

    if (isPanningActive) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Marquee Selection Box
    if (isDrawingMarquee) {
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setMarqueeEnd(canvasCoords);

      // Realtime compute intersected nodes
      const x1 = Math.min(marqueeStart.x, canvasCoords.x);
      const y1 = Math.min(marqueeStart.y, canvasCoords.y);
      const x2 = Math.max(marqueeStart.x, canvasCoords.x);
      const y2 = Math.max(marqueeStart.y, canvasCoords.y);

      const intersected = activeNodes.filter((node) => {
        if (!isNodeSelectable(node)) return false;
        const nodeW = node.properties.width || 140;
        const nodeH = node.properties.height || 52;
        const nodeLeft = node.x;
        const nodeRight = node.x + nodeW;
        const nodeTop = node.y;
        const nodeBottom = node.y + nodeH;
        return !(nodeRight < x1 || nodeLeft > x2 || nodeBottom < y1 || nodeTop > y2);
      });

      const intersectedIds = intersected.map((n) => n.id);
      setSelectedNodeIds(intersectedIds);
      if (intersectedIds.length > 0) {
        onSelectNode(intersectedIds[intersectedIds.length - 1]);
      } else {
        onSelectNode(null);
      }
      return;
    }

    // 3. Resizing
    if (isResizingActive && resizingNodeId) {
      const dx = (e.clientX - dragMouseStart.x) / zoom;
      const dy = (e.clientY - dragMouseStart.y) / zoom;
      let targetW = Math.max(80, Math.min(500, resizeStartSize.width + dx));
      let targetH = Math.max(40, Math.min(400, resizeStartSize.height + dy));
      if (snapSize > 0) {
        targetW = Math.round(targetW / snapSize) * snapSize;
        targetH = Math.round(targetH / snapSize) * snapSize;
      }
      const updatedNodes = nodes.map((n) => {
        if (n.id === resizingNodeId) {
          return {
            ...n,
            properties: {
              ...n.properties,
              width: targetW,
              height: targetH
            }
          };
        }
        return n;
      });
      if (onUpdateLayout) {
        onUpdateLayout(updatedNodes, connections);
      }
      return;
    }

    // 4. Rotating
    if (isRotatingActive && rotatingNodeId) {
      const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
      const dy = mouseCanvas.y - rotateCenter.y;
      const dx = mouseCanvas.x - rotateCenter.x;
      const currentAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let targetAngle = Math.round(currentAngleDeg + rotateStartAngle);
      if (e.shiftKey) {
        targetAngle = Math.round(targetAngle / 15) * 15;
      }
      targetAngle = (targetAngle % 360 + 360) % 360;

      const updatedNodes = nodes.map((n) => {
        if (n.id === rotatingNodeId) {
          return {
            ...n,
            properties: {
              ...n.properties,
              rotation: targetAngle
            }
          };
        }
        return n;
      });
      if (onUpdateLayout) {
        onUpdateLayout(updatedNodes, connections);
      }
      return;
    }

    // 5. Multi-node Dragging
    if (isNodeDraggingActive && draggingNodesStartCoords.length > 0) {
      const dx = (e.clientX - dragMouseStart.x) / zoom;
      const dy = (e.clientY - dragMouseStart.y) / zoom;

      // Update coordinates of all dragged nodes
      const updateCoordsMap = new Map<string, { x: number; y: number }>();
      draggingNodesStartCoords.forEach((start) => {
        const snapX = snapValue(start.x + dx);
        const snapY = snapValue(start.y + dy);

        // Keep inside reasonable bounds
        const boundedX = Math.max(-4500, Math.min(4500, snapX));
        const boundedY = Math.max(-4500, Math.min(4500, snapY));

        updateCoordsMap.set(start.id, { x: boundedX, y: boundedY });
      });

      const updatedNodes = nodes.map((node) => {
        const coords = updateCoordsMap.get(node.id);
        if (coords && isNodeSelectable(node)) {
          return { ...node, x: coords.x, y: coords.y };
        }
        return node;
      });

      if (onUpdateLayout) {
        onUpdateLayout(updatedNodes, connections);
      }
    }

    // 6. Active Connection dragging / creation or rewiring
    if (draggingConnectionSourceId) {
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setDraggingConnectionPos(canvasCoords);

      // Snap validation logic: Find nearest input port of any other node
      let nearestNodeId: string | null = null;
      let minDistance = 35; // snap distance threshold in canvas units

      nodes.forEach((node) => {
        if (node.id === draggingConnectionSourceId) return;
        if (node.type === "source") return; // source nodes don't accept inputs

        const inputPort = getInputPortCoords(node);
        const distance = Math.hypot(canvasCoords.x - inputPort.x, canvasCoords.y - inputPort.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearestNodeId = node.id;
        }
      });

      setDraggingConnectionTargetId(nearestNodeId);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) setIsMiddleMouseDown(false);
    if (e.button === 2) {
      setIsRightMouseDown(false);
      // If we dragged right-click to pan, don't show context menu, else open context menu
      const dx = Math.abs(e.clientX - panStart.x);
      const dy = Math.abs(e.clientY - panStart.y);
      if (dx < 5 && dy < 5) {
        openContextMenu(e, "canvas", null);
      }
    }

    if (draggingConnectionSourceId) {
      if (draggingConnectionTargetId) {
        // Valid connection target snapped!
        if (reconnectingConnectionId) {
          // Reconnect target of an existing connection
          const exists = connections.some((c) => c.id !== reconnectingConnectionId && c.sourceId === draggingConnectionSourceId && c.targetId === draggingConnectionTargetId);
          if (!exists) {
            pushHistorySnapshot();
            const updated = connections.map((c) =>
              c.id === reconnectingConnectionId ? { ...c, targetId: draggingConnectionTargetId! } : c
            );
            if (onUpdateLayout) {
              onUpdateLayout(nodes, updated);
            }
          }
        } else {
          // Add new connection
          onAddConnection(draggingConnectionSourceId, draggingConnectionTargetId);
        }
      } else {
        // Released on empty space (not snapped)
        if (reconnectingConnectionId) {
          // This represents disconnecting/unplugging the target handle!
          pushHistorySnapshot();
          const filtered = connections.filter((c) => c.id !== reconnectingConnectionId);
          if (onUpdateLayout) {
            onUpdateLayout(nodes, filtered);
          }
          if (onSelectConnection && selectedConnectionIds.includes(reconnectingConnectionId)) {
            onSelectConnection(null);
          }
        }
      }

      setDraggingConnectionSourceId(null);
      setDraggingConnectionPos(null);
      setDraggingConnectionTargetId(null);
      setReconnectingConnectionId(null);
      return;
    }

    if (isDrawingMarquee) {
      setIsDrawingMarquee(false);
    }

    if (isNodeDraggingActive) {
      setIsNodeDraggingActive(false);
      setDraggingNodesStartCoords([]);
    }

    if (isResizingActive) {
      setIsResizingActive(false);
      setResizingNodeId(null);
    }

    if (isRotatingActive) {
      setIsRotatingActive(false);
      setRotatingNodeId(null);
    }
  };

  // --- Node Mouse Triggers ---
  const handleNodeMouseDown = (e: React.MouseEvent, node: SimNode) => {
    e.stopPropagation();

    if (e.button === 2) {
      // Right click: select if not selected, then context menu
      if (!selectedNodeIds.includes(node.id)) {
        setSelectedNodeIds([node.id]);
        onSelectNode(node.id);
      }
      openContextMenu(e, "node", node.id);
      return;
    }

    if (e.button !== 0) return; // only left click

    if (linkingSourceId) {
      // Connect wires
      if (linkingSourceId !== node.id) {
        onAddConnection(linkingSourceId, node.id);
      }
      setLinkingSourceId(null);
      return;
    }

    // Toggle multi selection holding Ctrl or Shift
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;

    let nextSelectedIds = [...selectedNodeIds];

    if (isMultiSelect) {
      if (nextSelectedIds.includes(node.id)) {
        nextSelectedIds = nextSelectedIds.filter((id) => id !== node.id);
      } else {
        nextSelectedIds.push(node.id);
      }
    } else {
      if (!nextSelectedIds.includes(node.id)) {
        nextSelectedIds = [node.id];
      }
    }

    setSelectedNodeIds(nextSelectedIds);
    onSelectNode(node.id);

    // Prepare offsets for all selected nodes for moving
    if (isNodeSelectable(node)) {
      pushHistorySnapshot();
      const selectedActiveNodes = nodes.filter(
        (n) => nextSelectedIds.includes(n.id) && isNodeSelectable(n)
      );

      setDraggingNodesStartCoords(
        selectedActiveNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))
      );
      setDragMouseStart({ x: e.clientX, y: e.clientY });
      setIsNodeDraggingActive(true);
    }
  };

  // --- Context Menu controller ---
  const openContextMenu = (e: React.MouseEvent, type: "canvas" | "node" | "wire", targetId: string | null) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      targetType: type,
      targetId
    });
  };

  // --- Minimap Navigation Handler ---
  const handleMinimapDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const minimapRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - minimapRect.left;
    const clickY = e.clientY - minimapRect.top;

    // Map 0 -> 150px layout size
    // Find absolute layout boundary
    const nodeCoords = nodes.map((n) => ({ x: n.x, y: n.y }));
    const minX = nodeCoords.length > 0 ? Math.min(...nodeCoords.map((c) => c.x)) - 200 : -1000;
    const maxX = nodeCoords.length > 0 ? Math.max(...nodeCoords.map((c) => c.x)) + 300 : 1500;
    const minY = nodeCoords.length > 0 ? Math.min(...nodeCoords.map((c) => c.y)) - 200 : -1000;
    const maxY = nodeCoords.length > 0 ? Math.max(...nodeCoords.map((c) => c.y)) + 300 : 1500;

    const layoutWidth = maxX - minX;
    const layoutHeight = maxY - minY;

    const targetCanvasX = minX + (clickX / 150) * layoutWidth;
    const targetCanvasY = minY + (clickY / 100) * layoutHeight;

    // Pan viewport to center target coordinate
    const targetPanX = containerSize.width / 2 - targetCanvasX * zoom;
    const targetPanY = containerSize.height / 2 - targetCanvasY * zoom;

    setPanOffset({ x: targetPanX, y: targetPanY });
  };

  // --- Minimap Rendering parameters ---
  const minimapRenderData = useMemo(() => {
    const nodeCoords = nodes.map((n) => ({ x: n.x, y: n.y }));
    const minX = nodeCoords.length > 0 ? Math.min(...nodeCoords.map((c) => c.x)) - 200 : -1000;
    const maxX = nodeCoords.length > 0 ? Math.max(...nodeCoords.map((c) => c.x)) + 300 : 1500;
    const minY = nodeCoords.length > 0 ? Math.min(...nodeCoords.map((c) => c.y)) - 200 : -1000;
    const maxY = nodeCoords.length > 0 ? Math.max(...nodeCoords.map((c) => c.y)) + 300 : 1500;

    const layoutWidth = Math.max(2000, maxX - minX);
    const layoutHeight = Math.max(1500, maxY - minY);

    // Compute screen viewport rect within this local coordinate system
    const viewLeft = -panOffset.x / zoom;
    const viewRight = (-panOffset.x + containerSize.width) / zoom;
    const viewTop = -panOffset.y / zoom;
    const viewBottom = (-panOffset.y + containerSize.height) / zoom;

    // Translate to 150x100 minimap box bounds
    const scaleX = (x: number) => ((x - minX) / layoutWidth) * 150;
    const scaleY = (y: number) => ((y - minY) / layoutHeight) * 100;

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        x: scaleX(n.x),
        y: scaleY(n.y),
        w: (140 / layoutWidth) * 150,
        h: (52 / layoutHeight) * 100,
        color: n.properties.color || "#6366f1"
      })),
      viewport: {
        x: Math.max(0, Math.min(150, scaleX(viewLeft))),
        y: Math.max(0, Math.min(100, scaleY(viewTop))),
        w: Math.max(5, Math.min(150, ((viewRight - viewLeft) / layoutWidth) * 150)),
        h: Math.max(5, Math.min(100, ((viewBottom - viewTop) / layoutHeight) * 100))
      }
    };
  }, [nodes, panOffset, zoom, containerSize]);

  // --- Wheel zoom listener ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Position in canvas coordinate system before zooming
    const beforeX = (mouseX - panOffset.x) / zoom;
    const beforeY = (mouseY - panOffset.y) / zoom;

    // Zoom speed
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(0.12, Math.min(3.0, zoom * zoomFactor));

    const nextPanOffset = {
      x: mouseX - beforeX * nextZoom,
      y: mouseY - beforeY * nextZoom
    };

    setZoom(nextZoom);
    setPanOffset(nextPanOffset);
  };

  // Global reset zoom
  const handleResetView = () => {
    setZoom(1.0);
    setPanOffset({ x: 50, y: 50 });
  };

  return (
    <div
      id="canvas-viewport"
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-[540px] bg-slate-950 border border-slate-900 rounded-xl overflow-hidden select-none shadow-2xl transition-all duration-150 ${
        dragMode === "pan" || isSpacePressed ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
      }`}
    >
      {/* Infinite Grid background layer */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-75"
          style={{
            backgroundImage: "radial-gradient(#1e293b 1.5px, transparent 1.5px)",
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
          }}
        />
      )}

      {/* Main Canvas SVG and HTML translation transform wrapper */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: "0 0"
        }}
      >
        {/* SVG Connections & Link rendering wires */}
        <svg className="absolute inset-0 overflow-visible pointer-events-auto">
          <defs>
            <marker
              id="arrow-head"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>
            {/* Dynamic arrowheads matching connection colors */}
            {activeConnections.map((conn) => (
              <marker
                key={`marker-${conn.id}`}
                id={`arrow-head-${conn.id}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 1 L 10 5 L 0 9 z"
                  fill={conn.color || (selectedConnectionIds.includes(conn.id) ? "#6366f1" : "#334155")}
                />
              </marker>
            ))}
          </defs>

          {activeConnections.map((conn) => {
            const source = nodes.find((n) => n.id === conn.sourceId);
            const target = nodes.find((n) => n.id === conn.targetId);

            if (!source || !target) return null;

            const start = getOutputPortCoords(source);
            const end = getInputPortCoords(target);

            const style = conn.style || "bezier";
            const pathD = getConnectionPath(start.x, start.y, end.x, end.y, style);
            const mid = getMidpoint(start.x, start.y, end.x, end.y, style);

            const isSelected = selectedConnectionIds.includes(conn.id);
            const strokeColor = conn.color || (isSelected ? "#818cf8" : "#334155");
            const strokeWidth = isSelected ? "2.5" : "1.5";
            const strokeDash = conn.dashArray || "";

            return (
              <g key={conn.id} className="cursor-pointer group">
                {/* Thick wire overlay for clicking, multi-selection, and context menus */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      const isSel = selectedConnectionIds.includes(conn.id);
                      const updated = isSel
                        ? selectedConnectionIds.filter((id) => id !== conn.id)
                        : [...selectedConnectionIds, conn.id];
                      setSelectedConnectionIds(updated);
                      if (onSelectConnection && updated.length > 0) {
                        onSelectConnection(updated[updated.length - 1]);
                      }
                    } else {
                      setSelectedConnectionIds([conn.id]);
                      if (onSelectConnection) {
                        onSelectConnection(conn.id);
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    openContextMenu(e, "wire", conn.id);
                  }}
                />
                
                {/* Visual glow backdrop for selected wires */}
                {isSelected && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={parseFloat(strokeWidth) + 3}
                    strokeLinecap="round"
                    className="opacity-20 animate-pulse"
                  />
                )}

                {/* Visible connection path line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                  markerEnd={`url(#arrow-head-${conn.id})`}
                  className="transition-colors duration-150 group-hover:stroke-indigo-400"
                />

                {/* Interactive connection midpoint label/probability value */}
                {(conn.label || conn.weight !== undefined) && (
                  <foreignObject
                    x={mid.x - 50}
                    y={mid.y - 10}
                    width="100"
                    height="20"
                    className="overflow-visible"
                  >
                    <div className="flex items-center justify-center w-full h-full pointer-events-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionIds([conn.id]);
                          if (onSelectConnection) {
                            onSelectConnection(conn.id);
                          }
                        }}
                        className="pointer-events-auto px-2 py-0.5 rounded-full bg-slate-900/95 border border-slate-800 text-[8px] font-mono font-semibold text-slate-200 shadow-lg flex items-center gap-1 hover:border-indigo-400 hover:text-white transition-all scale-100 hover:scale-105"
                      >
                        {conn.label && <span className="text-slate-400">{conn.label}</span>}
                        {conn.weight !== undefined && (
                          <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1 rounded">
                            {(conn.weight * 100).toFixed(0)}%
                          </span>
                        )}
                      </button>
                    </div>
                  </foreignObject>
                )}

                {/* Particle Flow Pulses */}
                {activeEntityLocations[source.id] && (
                  <circle r="4" fill="#a78bfa" className="animate-pulse">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                )}

                {/* Connection modification and rewiring anchors */}
                {isSelected && (
                  <g>
                    {/* Source port pivot (immutable indicator) */}
                    <circle
                      cx={start.x}
                      cy={start.y}
                      r="4.5"
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      title="Source Anchor (Output Port)"
                    />
                    {/* Target port rewire handler (draggable to snap to other input ports) */}
                    <circle
                      cx={end.x}
                      cy={end.y}
                      r="6.5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-125 transition-transform animate-pulse pointer-events-auto shadow-md"
                      title="Drag this handle to reconnect to another input port"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setReconnectingConnectionId(conn.id);
                        setDraggingConnectionSourceId(conn.sourceId);
                        setDraggingConnectionPos({ x: end.x, y: end.y });
                        setDraggingConnectionTargetId(conn.targetId);
                      }}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Active Dragging Connection path */}
          {draggingConnectionSourceId && draggingConnectionPos && (() => {
            const sourceNode = nodes.find((n) => n.id === draggingConnectionSourceId);
            if (!sourceNode) return null;
            const start = getOutputPortCoords(sourceNode);
            const end = draggingConnectionTargetId
              ? getInputPortCoords(nodes.find((n) => n.id === draggingConnectionTargetId)!)
              : draggingConnectionPos;

            const path = getConnectionPath(start.x, start.y, end.x, end.y, "bezier");
            return (
              <g>
                <path
                  d={path}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  markerEnd="url(#arrow-head)"
                  className="animate-[dash_1s_linear_infinite]"
                />
                <circle
                  cx={end.x}
                  cy={end.y}
                  r="5"
                  fill="#22d3ee"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="animate-ping"
                />
              </g>
            );
          })()}

          {/* Render Highlight Markers on Target Ports when Connection creation is Active */}
          {draggingConnectionSourceId && (
            <g>
              {nodes.map((node) => {
                if (node.id === draggingConnectionSourceId) return null;
                if (node.type === "source") return null;

                const inputPort = getInputPortCoords(node);
                const isSnapped = draggingConnectionTargetId === node.id;

                return (
                  <circle
                    key={`highlight-${node.id}`}
                    cx={inputPort.x}
                    cy={inputPort.y}
                    r={isSnapped ? "12" : "7.5"}
                    fill={isSnapped ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.12)"}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    className={isSnapped ? "animate-ping" : "animate-pulse"}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Render HTML Nodes Layer */}
        <div className="absolute inset-0 pointer-events-none">
          {visibleNodes.map((node) => {
            const isSelected = selectedNodeIds.includes(node.id);
            const isActiveLinker = linkingSourceId === node.id;
            const activeEntitiesCount = parseInt(activeEntityLocations[node.id] || "0");
            const nodeColor = node.properties.color || "#6366f1";
            const nodeLayer = (node as any).layer || "default";

            const nodeW = node.properties.width || 140;
            const nodeH = node.properties.height || 52;
            const nodeRot = node.properties.rotation || 0;

            // Level of Detail (LOD) check
            const simplified = zoom < 0.35;

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${nodeW}px`,
                  height: `${nodeH}px`,
                  transform: `rotate(${nodeRot}deg)`,
                  position: "absolute",
                  borderLeft: `3px solid ${nodeColor}`
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                className={`rounded-lg border flex flex-col justify-between p-2 shadow-xl pointer-events-auto transition-all cursor-grab active:cursor-grabbing relative ${
                  isSelected
                    ? "ring-2 ring-indigo-500 scale-102 border-indigo-400 shadow-indigo-500/20 z-30"
                    : "hover:border-slate-700 bg-slate-950/90 hover:bg-slate-900/90 z-20"
                } ${isActiveLinker ? "ring-2 ring-cyan-500 animate-pulse" : ""}`}
                title={`Name: ${node.name} [Layer: ${nodeLayer}]`}
              >
                {/* Input Port (Left Edge) */}
                <div
                  className="absolute left-[-6px] top-[50%] translate-y-[-50%] w-3 h-3 rounded-full bg-slate-950 border-2 border-emerald-500 flex items-center justify-center z-40 cursor-crosshair hover:scale-125 transition-transform"
                  title="Input Connection Port"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (linkingSourceId && linkingSourceId !== node.id) {
                      onAddConnection(linkingSourceId, node.id);
                      setLinkingSourceId(null);
                    }
                  }}
                >
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                </div>

                {/* Output Port (Right Edge) */}
                <div
                  className={`absolute right-[-6px] top-[50%] translate-y-[-50%] w-3 h-3 rounded-full border-2 flex items-center justify-center z-40 cursor-crosshair hover:scale-125 transition-transform ${
                    isActiveLinker ? "bg-cyan-500 border-white animate-pulse" : "bg-slate-950 border-cyan-500"
                  }`}
                  title="Output Connection Port (Drag to connect, or click to wire)"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Start drag-to-connect!
                    const startPos = getOutputPortCoords(node);
                    setDraggingConnectionSourceId(node.id);
                    setDraggingConnectionPos(startPos);
                    setDraggingConnectionTargetId(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLinkingSourceId(isActiveLinker ? null : node.id);
                  }}
                >
                  <div className={`w-1 h-1 rounded-full ${isActiveLinker ? "bg-white" : "bg-cyan-400"}`} />
                </div>

                {/* Interactive Resize Handle (Corner) */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setResizingNodeId(node.id);
                      setResizeStartSize({
                        width: nodeW,
                        height: nodeH
                      });
                      setDragMouseStart({ x: e.clientX, y: e.clientY });
                      setIsResizingActive(true);
                    }}
                    className="absolute bottom-[-4px] right-[-4px] w-2.5 h-2.5 bg-indigo-500 border border-slate-100 rounded-sm cursor-se-resize z-50 pointer-events-auto shadow-md hover:bg-indigo-400"
                    title="Drag to resize node"
                  />
                )}

                {/* Interactive Rotation Stem Handle */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const centerX = node.x + nodeW / 2;
                      const centerY = node.y + nodeH / 2;
                      setRotatingNodeId(node.id);
                      setRotateCenter({ x: centerX, y: centerY });
                      const initialMouseCanvas = screenToCanvas(e.clientX, e.clientY);
                      const dy = initialMouseCanvas.y - centerY;
                      const dx = initialMouseCanvas.x - centerX;
                      const initialAngleRad = Math.atan2(dy, dx);
                      const initialAngleDeg = (initialAngleRad * 180) / Math.PI;
                      setRotateStartAngle(nodeRot - initialAngleDeg);
                      setIsRotatingActive(true);
                    }}
                    className="absolute top-[-16px] left-[50%] translate-x-[-50%] w-3.5 h-3.5 bg-indigo-500 border border-slate-100 rounded-full cursor-alias flex items-center justify-center z-50 pointer-events-auto shadow-md hover:bg-indigo-400"
                    title="Drag to rotate node (Hold Shift to snap)"
                  >
                    <div className="w-[1px] h-3 bg-indigo-500 absolute bottom-[-10px] left-[50%] translate-x-[-50%]" />
                  </div>
                )}

                {simplified ? (
                  // Simplified high-performance LOD block
                  <div
                    className="w-full h-full rounded"
                    style={{ backgroundColor: `${nodeColor}30`, border: `1px solid ${nodeColor}` }}
                  />
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                        {node.type}
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Simulation Particle badge */}
                        {activeEntitiesCount > 0 && (
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 text-[8px] font-bold text-white items-center justify-center">
                              {activeEntitiesCount}
                            </span>
                          </span>
                        )}
                        {/* Layer indicator badge */}
                        <span className="text-[7px] font-mono text-slate-600 border border-slate-900 px-1 rounded">
                          {nodeLayer.toUpperCase()}
                        </span>
                        {/* Deletion action */}
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNode(node.id);
                            }}
                            className="p-0.5 rounded bg-red-950/80 hover:bg-red-900/80 text-red-300 cursor-pointer"
                            title="Remove Node"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer / Label */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-mono font-semibold text-slate-100 truncate pr-1">
                        {node.name}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Marquee/Box selection box overlay */}
      {isDrawingMarquee && (
        <div
          className="absolute border border-indigo-500 bg-indigo-500/10 pointer-events-none rounded"
          style={{
            left: `${Math.min(marqueeStart.x * zoom + panOffset.x, marqueeEnd.x * zoom + panOffset.x)}px`,
            top: `${Math.min(marqueeStart.y * zoom + panOffset.y, marqueeEnd.y * zoom + panOffset.y)}px`,
            width: `${Math.abs((marqueeEnd.x - marqueeStart.x) * zoom)}px`,
            height: `${Math.abs((marqueeEnd.y - marqueeStart.y) * zoom)}px`
          }}
        />
      )}

      {/* top HUD overlay: Canvas Navigation & Options */}
      <div className="absolute top-3 left-4 pointer-events-none z-10 flex flex-wrap gap-2 max-w-[80%]">
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider bg-slate-900/90 border border-slate-800 px-2 py-1 rounded shadow-lg backdrop-blur-sm pointer-events-auto">
          Zoom: {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleResetView}
          className="text-[9px] font-mono text-slate-400 hover:text-slate-200 uppercase bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 px-2 py-1 rounded shadow-lg backdrop-blur-sm cursor-pointer pointer-events-auto"
          title="Reset zoom to 100% and center"
        >
          Reset View
        </button>

        {/* Snap Size selection selector */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded px-2 py-0.5 shadow-lg backdrop-blur-sm text-slate-400 pointer-events-auto">
          <Grid className="w-3 h-3 text-indigo-400" />
          <select
            value={snapSize}
            onChange={(e) => setSnapSize(parseInt(e.target.value))}
            className="bg-transparent text-[9px] font-mono focus:outline-none border-none text-slate-300 uppercase cursor-pointer"
          >
            <option value="0">No Snap</option>
            <option value="5">Snap: 5px</option>
            <option value="10">Snap: 10px</option>
            <option value="20">Snap: 20px</option>
            <option value="50">Snap: 50px</option>
          </select>
        </div>

        {/* Grid Visibility toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`text-[9px] font-mono uppercase bg-slate-900/90 border px-2 py-1 rounded shadow-lg backdrop-blur-sm cursor-pointer pointer-events-auto transition-colors ${
            showGrid ? "text-indigo-400 border-indigo-900" : "text-slate-500 border-slate-800"
          }`}
          title="Toggle Grid dots"
        >
          {showGrid ? "GRID ON" : "GRID OFF"}
        </button>
      </div>

      {/* Floating Link alert banner */}
      {linkingSourceId && (
        <div className="absolute top-3 right-4 z-15 bg-indigo-950/90 border border-indigo-500/40 text-indigo-300 text-[9px] font-mono px-3 py-1.5 rounded-lg animate-pulse shadow-lg backdrop-blur-sm">
          Click terminal pin/box of another node to connect process wire...
        </div>
      )}

      {/* Align & Edit Floating Toolbox overlay - active when multi nodes selected */}
      {selectedNodeIds.length >= 2 && (
        <div className="absolute top-14 left-4 z-10 flex items-center gap-1.5 bg-slate-900/95 border border-indigo-500/20 rounded-xl p-1.5 shadow-2xl backdrop-blur-md">
          <div className="text-[8px] font-mono text-slate-500 uppercase px-1.5 font-bold">ALIGN:</div>
          <button
            onClick={() => handleAlign("left")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Left"
          >
            <AlignLeft className="w-3.5 h-3.5 rotate-90" />
          </button>
          <button
            onClick={() => handleAlign("center")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Centers"
          >
            <AlignCenter className="w-3.5 h-3.5 rotate-90" />
          </button>
          <button
            onClick={() => handleAlign("right")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Right"
          >
            <AlignRight className="w-3.5 h-3.5 rotate-90" />
          </button>
          <button
            onClick={() => handleAlign("top")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Top"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleAlign("middle")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Middles"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleAlign("bottom")}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
            title="Align Selected Bottom"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          {/* Distribute handles */}
          {selectedNodeIds.length >= 3 && (
            <>
              <div className="h-4 w-[1px] bg-slate-800 mx-1" />
              <button
                onClick={() => handleDistribute("h")}
                className="p-1.5 py-1 text-[8px] font-mono rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
                title="Distribute Nodes Horizontally"
              >
                DIST-H
              </button>
              <button
                onClick={() => handleDistribute("v")}
                className="p-1.5 py-1 text-[8px] font-mono rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 cursor-pointer"
                title="Distribute Nodes Vertically"
              >
                DIST-V
              </button>
            </>
          )}

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />
          <button
            onClick={handleDeleteSelected}
            className="p-1 rounded bg-red-950/45 hover:bg-red-900/60 text-red-400 border border-red-900/20 cursor-pointer"
            title="Delete Selected Group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Layer manager quick drawer on bottom left */}
      <div className="absolute bottom-3 left-4 z-10 flex flex-col pointer-events-none">
        {showLayerWidget ? (
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 w-52 shadow-2xl backdrop-blur-md pointer-events-auto flex flex-col mb-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> System Layers
              </span>
              <button
                onClick={() => setShowLayerWidget(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto max-h-40">
              {layers.map((layer) => {
                const layerNodeCount = nodes.filter((n) => ((n as any).layer || "default") === layer.id).length;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`flex items-center justify-between p-1 px-2 rounded-md border text-[9px] font-mono cursor-pointer transition-colors ${
                      activeLayerId === layer.id
                        ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                        : "bg-slate-950/40 border-slate-900 hover:bg-slate-900/40 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {activeLayerId === layer.id && <Check className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                      <span className="truncate">{layer.name}</span>
                      <span className="text-[7px] text-slate-600 bg-slate-950 px-1 rounded font-sans">
                        {layerNodeCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Hide / Show trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLayers(
                            layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l))
                          );
                        }}
                        className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                        title={layer.visible ? "Hide Layer" : "Show Layer"}
                      >
                        {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>

                      {/* Lock trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLayers(
                            layers.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l))
                          );
                        }}
                        className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                        title={layer.locked ? "Unlock Layer" : "Lock Layer"}
                      >
                        {layer.locked ? <Lock className="w-3 h-3 text-red-500" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800 pt-1.5 mt-2 flex items-center justify-between">
              <span className="text-[7px] font-mono text-slate-500">
                ACTIVE EDIT LAYER: <b className="text-indigo-400">{activeLayerId.toUpperCase()}</b>
              </span>
            </div>
          </div>
        ) : null}

        <button
          onClick={() => setShowLayerWidget(!showLayerWidget)}
          className={`flex items-center gap-1.5 text-[9px] font-mono uppercase bg-slate-900/90 border px-2.5 py-1.5 rounded shadow-lg backdrop-blur-sm cursor-pointer pointer-events-auto transition-colors ${
            showLayerWidget ? "text-indigo-400 border-indigo-900" : "text-slate-400 border-slate-800 hover:text-slate-200"
          }`}
          title="Layer settings panel"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Layers Engine</span>
        </button>
      </div>

      {/* Interactive Floating Minimap and Zoom controllers HUD inside bottom-right corner */}
      <div className="absolute bottom-3 right-4 z-10 flex flex-col items-end gap-2 pointer-events-none">
        
        {/* Undo/Redo & Zoom Quick Control toolbar */}
        <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-lg p-1 shadow-lg pointer-events-auto backdrop-blur-md">
          <button
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
            title="Undo last layout edit (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
            title="Redo previous layout edit (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          
          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            onClick={() => {
              setZoom((z) => Math.max(0.15, z - 0.1));
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom((z) => Math.min(3.0, z + 0.1));
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scaled interactive minimap block */}
        <div
          onClick={handleMinimapDrag}
          onMouseMove={(e) => {
            if (e.buttons === 1) handleMinimapDrag(e);
          }}
          className="relative w-[150px] h-[100px] bg-slate-950/95 border border-slate-800 rounded-xl overflow-hidden cursor-crosshair pointer-events-auto shadow-2xl backdrop-blur-sm"
        >
          {/* Render scaled mini boxes */}
          {minimapRenderData.nodes.map((mini) => (
            <div
              key={mini.id}
              style={{
                left: `${mini.x}px`,
                top: `${mini.y}px`,
                width: `${mini.w}px`,
                height: `${mini.h}px`,
                backgroundColor: `${mini.color}40`,
                border: `0.5px solid ${mini.color}`
              }}
              className="absolute rounded-sm pointer-events-none"
            />
          ))}

          {/* Glowing viewport tracker frame */}
          <div
            style={{
              left: `${minimapRenderData.viewport.x}px`,
              top: `${minimapRenderData.viewport.y}px`,
              width: `${minimapRenderData.viewport.w}px`,
              height: `${minimapRenderData.viewport.h}px`
            }}
            className="absolute border border-indigo-500 bg-indigo-500/10 rounded-sm pointer-events-none shadow-[0_0_10px_rgba(99,102,241,0.25)]"
          />

          <span className="absolute bottom-1 right-1.5 text-[6px] font-mono text-slate-600 uppercase font-bold">
            Minimap HUD
          </span>
        </div>
      </div>

      {/* Absolute context menu popup */}
      {contextMenu && (
        <div
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            position: "absolute"
          }}
          className="z-50 bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 w-48 shadow-2xl backdrop-blur-md text-slate-200 animate-fade-in text-[10px] font-mono space-y-0.5"
        >
          {contextMenu.targetType === "node" && (
            <>
              <div className="px-2.5 py-1 border-b border-slate-800 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                Node Operations
              </div>
              <button
                onClick={() => {
                  handleCopyAction();
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
              >
                <span>Copy Node</span>
                <span className="text-[8px] text-slate-600">Ctrl+C</span>
              </button>
              <button
                onClick={() => {
                  handleCutAction();
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
              >
                <span>Cut Node</span>
                <span className="text-[8px] text-slate-600">Ctrl+X</span>
              </button>
              <button
                onClick={() => {
                  onDeleteNode(contextMenu.targetId!);
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-red-950/40 text-red-400 flex items-center justify-between cursor-pointer"
              >
                <span>Delete Node</span>
                <span className="text-[8px] text-red-900">Del</span>
              </button>
              
              <div className="border-t border-slate-850 my-1" />
              
              {/* Layer Selection submenu inside context menu */}
              <div className="px-2.5 py-0.5 text-[7px] text-slate-600 uppercase">Shift to layer:</div>
              {layers.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    pushHistorySnapshot();
                    const updatedNodes = nodes.map((n) =>
                      n.id === contextMenu.targetId ? ({ ...n, layer: l.id } as any as SimNode) : n
                    );
                    if (onUpdateLayout) onUpdateLayout(updatedNodes, connections);
                    setContextMenu(null);
                  }}
                  className="w-full text-left p-1 px-3 rounded-md hover:bg-slate-800 text-[8px] flex items-center justify-between text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <span>{l.name}</span>
                  {(nodes.find((n) => n.id === contextMenu.targetId) as any)?.layer === l.id && (
                    <Check className="w-2.5 h-2.5 text-indigo-400" />
                  )}
                </button>
              ))}
            </>
          )}

          {contextMenu.targetType === "wire" && (
            <>
              <div className="px-2.5 py-1 border-b border-slate-800 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                Wire Operations
              </div>
              <button
                onClick={() => {
                  onDeleteConnection(contextMenu.targetId!);
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-red-950/40 text-red-400 flex items-center justify-between cursor-pointer"
              >
                <span>Delete Wire link</span>
                <span className="text-[8px] text-red-900">Del</span>
              </button>
            </>
          )}

          {contextMenu.targetType === "canvas" && (
            <>
              <div className="px-2.5 py-1 border-b border-slate-800 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                Canvas Operations
              </div>
              <button
                onClick={() => {
                  handlePasteAction({ x: contextMenu.x + containerRef.current!.getBoundingClientRect().left, y: contextMenu.y + containerRef.current!.getBoundingClientRect().top });
                  setContextMenu(null);
                }}
                disabled={!clipboard}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-slate-800 flex items-center justify-between cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
              >
                <span>Paste Schematic</span>
                <span className="text-[8px] text-slate-600">Ctrl+V</span>
              </button>
              <button
                onClick={() => {
                  // Select All
                  const selectableIds = activeNodes.filter(isNodeSelectable).map((n) => n.id);
                  setSelectedNodeIds(selectableIds);
                  if (selectableIds.length > 0) {
                    onSelectNode(selectableIds[selectableIds.length - 1]);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
              >
                <span>Select All Nodes</span>
                <span className="text-[8px] text-slate-600">Ctrl+A</span>
              </button>
              <button
                onClick={() => {
                  handleResetView();
                  setContextMenu(null);
                }}
                className="w-full text-left p-1.5 px-2.5 rounded-md hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
              >
                <span>Reset View layout</span>
                <span className="text-[8px] text-slate-600">Center</span>
              </button>
              
              <div className="border-t border-slate-850 my-1" />
              
              <div className="px-2 py-0.5 text-[8px] text-slate-600 uppercase">Spawn Node:</div>
              {(["source", "queue", "processor", "router", "sink"] as NodeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const canvasCoords = screenToCanvas(
                      contextMenu.x + containerRef.current!.getBoundingClientRect().left,
                      contextMenu.y + containerRef.current!.getBoundingClientRect().top
                    );
                    pushHistorySnapshot();

                    const newId = `${type.slice(0, 3)}_${Math.floor(Math.random() * 100000)}`;
                    const newNode: SimNode = {
                      id: newId,
                      type,
                      name: `New ${type.toUpperCase()}`,
                      x: snapValue(canvasCoords.x - 70),
                      y: snapValue(canvasCoords.y - 26),
                      properties: {
                        color: type === "processor" ? "#6366f1" : type === "queue" ? "#eab308" : "#10b981",
                        ...(type === "source" ? { arrivalInterval: 10 } : {}),
                        ...(type === "processor" ? { processingTime: 8, capacity: 1 } : {}),
                        ...(type === "queue" ? { capacity: 9999 } : {}),
                        ...(type === "router" ? { routeProbability: 0.5 } : {})
                      }
                    };
                    (newNode as any).layer = activeLayerId;

                    const updatedNodes = [...nodes, newNode];
                    if (onUpdateLayout) onUpdateLayout(updatedNodes, connections);
                    setSelectedNodeIds([newId]);
                    onSelectNode(newId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left p-1 px-3 rounded-md hover:bg-slate-800 text-[8px] text-slate-400 hover:text-slate-200 cursor-pointer capitalize"
                >
                  + Spawn {type}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Floating Keyboard shortcuts information guide bar on lower left (dismissible) */}
      <div className="absolute bottom-14 right-4 z-10 pointer-events-none text-right hidden sm:block max-w-xs">
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg text-[8px] font-mono text-slate-500 leading-normal inline-block shadow-lg">
          <div><b>Ctrl+C / V / X</b>: Copy / Paste / Cut</div>
          <div><b>Ctrl+Z / Y</b>: Undo / Redo</div>
          <div><b>Delete</b>: Delete | <b>Ctrl+A</b>: Select All</div>
          <div><b>Space + Drag</b> / <b>Middle drag</b>: Pan Canvas</div>
          <div><b>Scroll wheel</b>: Zoom Canvas viewport</div>
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none z-0">
          <p className="text-slate-600 font-mono text-xs">WORKFLOW SCHEMATIC EMPTY</p>
          <p className="text-slate-700 text-[10px] font-mono mt-1 max-w-xs">
            Drag objects from the library panel on the left, right-click the canvas to spawn, or write an AI copilot prompt to build your layout.
          </p>
        </div>
      )}
    </div>
  );
}
