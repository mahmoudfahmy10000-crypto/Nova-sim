import React, { useEffect, useRef, useState } from "react";
import { SimNode, SimConnection, SimEntity } from "../../core/simulation/types";
import { RotateCcw, ZoomIn, ZoomOut, Compass } from "lucide-react";

interface Viewport3DProps {
  nodes: SimNode[];
  connections: SimConnection[];
  entities: SimEntity[];
  clockTime: number;
}

interface Particle3D {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
}

export default function Viewport3D({
  nodes,
  connections,
  entities,
  clockTime
}: Viewport3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D Camera State
  const [rotation, setRotation] = useState<number>(Math.PI / 6); // Angle of rotation (30 degrees default)
  const [pitch, setPitch] = useState<number>(0.5); // Vertical slant
  const [zoom, setZoom] = useState<number>(0.85);

  const [particles, setParticles] = useState<Particle3D[]>([]);

  // Spawn visual particles when entities traverse nodes
  useEffect(() => {
    // Collect nodes that have active processing entities
    const newParticles: Particle3D[] = [];

    connections.forEach((conn) => {
      const source = nodes.find((n) => n.id === conn.sourceId);
      const target = nodes.find((n) => n.id === conn.targetId);

      if (source && target) {
        // Spawn active flow lines representation
        const count = entities.filter((e) => e.currentLocationId === source.id).length;
        if (count > 0 && Math.random() < 0.2) {
          newParticles.push({
            id: `p_${Math.random()}_${Date.now()}`,
            sourceX: source.x,
            sourceY: source.y,
            targetX: target.x,
            targetY: target.y,
            progress: 0,
            speed: 0.01 + Math.random() * 0.015,
            color: source.properties.color || "#818cf8"
          });
        }
      }
    });

    setParticles((prev) => {
      // Filter out completed particles and update others
      const updated = prev
        .map((p) => ({ ...p, progress: p.progress + p.speed }))
        .filter((p) => p.progress < 1.0);
      return [...updated, ...newParticles].slice(0, 100); // Limit count to 100 particles for extreme speed
    });
  }, [clockTime, entities, connections, nodes]);

  // Viewport Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      // Clear with dark tech gradient
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save context
      ctx.save();
      
      // Center the viewport
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.translate(cx, cy);

      // Draw Grid helper
      drawGrid(ctx);

      // Draw Connection Paths in 3D
      drawPaths3D(ctx);

      // Draw Flow Particles in 3D
      drawParticles3D(ctx);

      // Draw Node solid objects in 3D (sorted by isometric depth to resolve overlaps!)
      drawNodes3D(ctx);

      ctx.restore();

      animFrameId = requestAnimationFrame(render);
    };

    // Isometric Projection Mapping
    // 2D Coordinates (x, y) map to 3D center positions
    const getIsoCoords = (x: number, y: number, z: number) => {
      // Translate coordinates relative to map center (approx 500, 300)
      const relativeX = (x - 450) * zoom;
      const relativeY = (y - 250) * zoom;
      const relativeZ = z * zoom;

      // Apply rotation about Z axis
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);

      const rotX = relativeX * cosR - relativeY * sinR;
      const rotY = relativeX * sinR + relativeY * cosR;

      // Project into 2D isometric screen coordinates
      const screenX = rotX;
      const screenY = rotY * pitch - relativeZ;

      return { x: screenX, y: screenY };
    };

    const drawGrid = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;

      const gridSize = 40;
      const range = 10; // lines in each direction

      for (let i = -range; i <= range; i++) {
        // Line along X
        const p1 = getIsoCoords(450 - range * gridSize, 250 + i * gridSize, 0);
        const p2 = getIsoCoords(450 + range * gridSize, 250 + i * gridSize, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Line along Y
        const q1 = getIsoCoords(450 + i * gridSize, 250 - range * gridSize, 0);
        const q2 = getIsoCoords(450 + i * gridSize, 250 + range * gridSize, 0);
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.stroke();
      }

      // Draw origin axes
      const origin = getIsoCoords(450, 250, 0);
      const axisX = getIsoCoords(550, 250, 0);
      const axisY = getIsoCoords(450, 350, 0);
      const axisZ = getIsoCoords(450, 250, 100);

      // Red X Axis
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisX.x, axisX.y);
      ctx.stroke();

      // Green Y Axis
      ctx.strokeStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisY.x, axisY.y);
      ctx.stroke();

      // Blue Z Axis
      ctx.strokeStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisZ.x, axisZ.y);
      ctx.stroke();
    };

    const drawPaths3D = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
      ctx.lineWidth = 2.5;

      connections.forEach((conn) => {
        const src = nodes.find((n) => n.id === conn.sourceId);
        const tgt = nodes.find((n) => n.id === conn.targetId);

        if (src && tgt) {
          const start = getIsoCoords(src.x, src.y, 10);
          const end = getIsoCoords(tgt.x, tgt.y, 10);

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      });
    };

    const drawParticles3D = (ctx: CanvasRenderingContext2D) => {
      particles.forEach((p) => {
        // Linear interpolation in 3D
        const x = p.sourceX + (p.targetX - p.sourceX) * p.progress;
        const y = p.sourceY + (p.targetY - p.sourceY) * p.progress;
        
        // Dynamic arc height for particles
        const arcZ = Math.sin(p.progress * Math.PI) * 50 + 10;

        const pos = getIsoCoords(x, y, arcZ);

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
        ctx.stroke();
      });
    };

    const drawNodes3D = (ctx: CanvasRenderingContext2D) => {
      // Sort nodes based on their isometric projected depth to draw back-to-front
      const sortedNodes = [...nodes].sort((a, b) => {
        // Depth factor along the rotation-adjusted camera view vector
        const depthA = a.x * Math.cos(rotation) + a.y * Math.sin(rotation);
        const depthB = b.x * Math.cos(rotation) + b.y * Math.sin(rotation);
        return depthA - depthB; // Draw further elements first
      });

      sortedNodes.forEach((node) => {
        const color = node.properties.color || "#6366f1";
        const hasEntities = entities.some((e) => e.currentLocationId === node.id);

        // Define isometric 3D dimensions
        const sizeX = 40;
        const sizeY = 40;
        const sizeZ = node.type === "processor" ? 60 : 30;

        // Base center coords on grid
        const nx = node.x;
        const ny = node.y;

        // Draw node bounding shape (glowing box or cylinder)
        if (node.type === "processor") {
          drawSolidBox(ctx, nx, ny, sizeX, sizeY, sizeZ, color, hasEntities);
        } else if (node.type === "queue") {
          drawCylinder(ctx, nx, ny, sizeX / 2, sizeZ, "#eab308", hasEntities);
        } else if (node.type === "source") {
          drawPyramid(ctx, nx, ny, sizeX, sizeZ, "#10b981");
        } else if (node.type === "sink") {
          drawSolidBox(ctx, nx, ny, sizeX, sizeY, sizeZ / 2, "#ef4444", false);
        } else {
          // Router / decision diamond
          drawPyramid(ctx, nx, ny, sizeX, sizeZ, "#06b6d4");
        }

        // Add 3D text tag floating directly above the machine
        const textPos = getIsoCoords(nx, ny, sizeZ + 25);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(node.name.toUpperCase(), textPos.x, textPos.y);

        // Draw tiny active load counter floating underneath name
        const activeCount = entities.filter((e) => e.currentLocationId === node.id).length;
        if (activeCount > 0) {
          const counterPos = getIsoCoords(nx, ny, sizeZ + 12);
          ctx.fillStyle = "#a78bfa";
          ctx.font = "8px monospace";
          ctx.fillText(`[ LOAD: ${activeCount} ]`, counterPos.x, counterPos.y);
        }
      });
    };

    // 3D Cuboid Renderer
    const drawSolidBox = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      sx: number,
      sy: number,
      sz: number,
      baseColor: string,
      glow: boolean
    ) => {
      const halfX = sx / 2;
      const halfY = sy / 2;

      // 8 Vertices of the Cuboid
      const v0 = getIsoCoords(cx - halfX, cy - halfY, 0); // Bottom Back
      const v1 = getIsoCoords(cx + halfX, cy - halfY, 0); // Bottom Right
      const v2 = getIsoCoords(cx + halfX, cy + halfY, 0); // Bottom Front
      const v3 = getIsoCoords(cx - halfX, cy + halfY, 0); // Bottom Left

      const v4 = getIsoCoords(cx - halfX, cy - halfY, sz); // Top Back
      const v5 = getIsoCoords(cx + halfX, cy - halfY, sz); // Top Right
      const v6 = getIsoCoords(cx + halfX, cy + halfY, sz); // Top Front
      const v7 = getIsoCoords(cx - halfX, cy + halfY, sz); // Top Left

      // Render wireframe outline or shaded faces
      ctx.lineWidth = glow ? 2 : 1;
      ctx.strokeStyle = glow ? "#a78bfa" : baseColor;

      // Shaded Top Face
      ctx.fillStyle = glow ? "rgba(167, 139, 250, 0.25)" : "rgba(30, 41, 59, 0.65)";
      ctx.beginPath();
      ctx.moveTo(v4.x, v4.y);
      ctx.lineTo(v5.x, v5.y);
      ctx.lineTo(v6.x, v6.y);
      ctx.lineTo(v7.x, v7.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shaded Front-Right Face
      ctx.fillStyle = glow ? "rgba(167, 139, 250, 0.15)" : "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.lineTo(v6.x, v6.y);
      ctx.lineTo(v5.x, v5.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shaded Front-Left Face
      ctx.fillStyle = glow ? "rgba(167, 139, 250, 0.1)" : "rgba(30, 41, 59, 0.45)";
      ctx.beginPath();
      ctx.moveTo(v2.x, v2.y);
      ctx.lineTo(v3.x, v3.y);
      ctx.lineTo(v7.x, v7.y);
      ctx.lineTo(v6.x, v6.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // 3D Cylinder Renderer
    const drawCylinder = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      radius: number,
      height: number,
      color: string,
      glow: boolean
    ) => {
      const bottomCenter = getIsoCoords(cx, cy, 0);
      const topCenter = getIsoCoords(cx, cy, height);

      ctx.strokeStyle = color;
      ctx.lineWidth = glow ? 2 : 1;

      // Draw bottom ellipse
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.beginPath();
      ctx.ellipse(bottomCenter.x, bottomCenter.y, radius * zoom, radius * pitch * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw vertical wall sides
      const leftBottom = getIsoCoords(cx - radius, cy, 0);
      const rightBottom = getIsoCoords(cx + radius, cy, 0);
      const leftTop = getIsoCoords(cx - radius, cy, height);
      const rightTop = getIsoCoords(cx + radius, cy, height);

      ctx.fillStyle = glow ? "rgba(234, 179, 8, 0.15)" : "rgba(30, 41, 59, 0.45)";
      ctx.beginPath();
      ctx.moveTo(leftBottom.x, leftBottom.y);
      ctx.lineTo(rightBottom.x, rightBottom.y);
      ctx.lineTo(rightTop.x, rightTop.y);
      ctx.lineTo(leftTop.x, leftTop.y);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(leftBottom.x, leftBottom.y);
      ctx.lineTo(leftTop.x, leftTop.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightBottom.x, rightBottom.y);
      ctx.lineTo(rightTop.x, rightTop.y);
      ctx.stroke();

      // Draw top ellipse
      ctx.fillStyle = glow ? "rgba(234, 179, 8, 0.35)" : "rgba(30, 41, 59, 0.75)";
      ctx.beginPath();
      ctx.ellipse(topCenter.x, topCenter.y, radius * zoom, radius * pitch * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // 3D Pyramid Renderer
    const drawPyramid = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      height: number,
      color: string
    ) => {
      const half = size / 2;

      const p0 = getIsoCoords(cx - half, cy - half, 0); // Base Bottom Left
      const p1 = getIsoCoords(cx + half, cy - half, 0); // Base Bottom Right
      const p2 = getIsoCoords(cx + half, cy + half, 0); // Base Front Right
      const p3 = getIsoCoords(cx - half, cy + half, 0); // Base Front Left
      const peak = getIsoCoords(cx, cy, height); // Apex

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      // Draw 4 Triangular faces
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      const faces = [
        [p0, p1, peak],
        [p1, p2, peak],
        [p2, p3, peak],
        [p3, p0, peak]
      ];

      faces.forEach((face) => {
        ctx.beginPath();
        ctx.moveTo(face[0].x, face[0].y);
        ctx.lineTo(face[1].x, face[1].y);
        ctx.lineTo(face[2].x, face[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [nodes, connections, entities, rotation, pitch, zoom, particles]);

  // Adjust canvas dimensions to container bounds on load/resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = 520;
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[520px] bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-inner">
      {/* 3D Viewport Controls HUD Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex flex-col gap-2.5 font-mono text-[10px] w-48">
        <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-indigo-400" />
          Camera Controller
        </div>
        
        {/* Rotation Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-slate-400 text-[9px]">
            <span>PAN ANGLE</span>
            <span>{(rotation * (180 / Math.PI)).toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.PI * 2}
            step={0.05}
            value={rotation}
            onChange={(e) => setRotation(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-indigo-500"
          />
        </div>

        {/* Pitch Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-slate-400 text-[9px]">
            <span>PITCH SLOPE</span>
            <span>{(pitch * 90).toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.9}
            step={0.05}
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-ns-resize accent-indigo-500"
          />
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2 mt-1">
          <span className="text-slate-400 text-[9px]">ZOOM</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
              title="Zoom Out"
            >
              <ZoomOut className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
              title="Zoom In"
            >
              <ZoomIn className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => {
                setRotation(Math.PI / 6);
                setPitch(0.5);
                setZoom(0.85);
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
              title="Reset View"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-none z-10 flex gap-4">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900/85 px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping"></span>
          WebGL surrogate
        </span>
      </div>

      {/* Render Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
