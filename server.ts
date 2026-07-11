import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { DiscreteEventSimulation } from "./src/core/simulation/DiscreteEventSimulation";
import { SimulationLayout } from "./src/core/simulation/types";

// Clean Architecture Imports
import { PostgresClient } from "./src/infrastructure/database/PostgresClient";
import { ProjectService } from "./src/application/services/ProjectService";
import { AuthService } from "./src/application/services/AuthService";
import { Logger } from "./src/shared/logging/Logger";

// Load environment variables
dotenv.config();

// Initialize logger
const logger = Logger.getInstance();

// Initialize Gemini SDK
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  logger.warn("GEMINI_API_KEY is not set in environment. Chatbot and AI layout features will be offline.", "SYSTEM");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Create HTTP Server
  const server = http.createServer(app);

  // Middleware
  app.use(express.json());

  // Initialize and run database migrations if PostgreSQL is configured
  const postgres = PostgresClient.getInstance();
  if (postgres.isConnected()) {
    try {
      await postgres.runMigrations();
    } catch (e: any) {
      logger.error("Failed to run database migrations on boot. Falling back.", e, "DATABASE");
    }
  }

  // Instantiate application services
  const projectService = ProjectService.getInstance();
  const authService = AuthService.getInstance();

  // JWT Middleware for route protection
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required." });
    }

    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (err: any) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }
  };

  // REST API: Authenticate operator & return token
  app.post("/api/auth/login", (req, res) => {
    const { username, role } = req.body;
    if (!username || !role) {
      return res.status(400).json({ error: "Username and role are required." });
    }
    
    try {
      const token = authService.generateToken(username, role);
      res.json({ token, username, role });
    } catch (err: any) {
      res.status(500).json({ error: "Authentication failed." });
    }
  });

  // REST API: Get Default Project Layout
  app.get("/api/projects/default", async (req, res) => {
    try {
      const project = await projectService.getProject("proj_default");
      if (project) {
        res.json({ id: "proj_default", layout: project.layout });
      } else {
        res.json({ id: "proj_default", layout: { nodes: [], connections: [] } });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch project." });
    }
  });

  // REST API: Save Default Project Layout
  app.post("/api/projects/default", async (req, res) => {
    const layout: SimulationLayout = req.body;
    if (!layout || !Array.isArray(layout.nodes)) {
      return res.status(400).json({ error: "Invalid layout payload" });
    }
    
    try {
      await projectService.saveProject({
        id: "proj_default",
        name: "Standard Factory Assembly",
        description: "Classic 3-stage CNC factory milling line with deterministic arrival rates.",
        lastSaved: new Date().toISOString(),
        layout: layout,
        versions: []
      });
      res.json({ status: "success", message: "Layout written to persistent storage." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to persist layout." });
    }
  });

  // REST API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", aiConfigured: !!ai, dbConnected: postgres.isConnected() });
  });

  // AI API: Layout configuration compiler using Gemini
  app.post("/api/ai-configure", async (req, res) => {
    try {
      const { prompt, currentLayout } = req.body;

      if (!ai) {
        return res.status(500).json({
          error: "Gemini API is currently offline. Please provide GEMINI_API_KEY."
        });
      }

      if (!prompt) {
        return res.status(400).json({ error: "Instruction prompt is required." });
      }

      const systemInstruction = `You are the high-fidelity AI CAD Layout compiler of NovaSim AI.
Your job is to parse a natural language instruction to construct or edit an industrial simulation workflow canvas layout.
You receive:
1. The user request prompt (such as "Add a lathe machine connected to the buffer queue").
2. The current layout consisting of active nodes and connections.

You must modify or completely rebuild the layout according to the user instructions.
Follow these placement guidelines to make the canvas look visually spectacular:
- Sources (arrival points) should be placed on the far left (e.g. x=50, y=180).
- Buffers / Queues should be placed around x=260, y=180.
- Processors / Machines should be placed around x=480, y=180.
- Routers / Decisions should be placed around x=620, y=180.
- Sinks (terminal exit nodes) should be placed on the far right (e.g. x=760, y=180).
- If multiple items exist in the same category, stagger their vertical positions (e.g., y=100, y=260, y=420) to maintain negative spacing and avoid crossed/overlapping wire paths.
- Ensure all nodes linked by connections have valid, matching sourceId and targetId.

You MUST return a valid JSON object matching this schema exactly, and nothing else:
{
  "layout": {
    "nodes": [
      {
        "id": "string (unique)",
        "type": "source" | "queue" | "processor" | "sink" | "router",
        "name": "string (human label)",
        "x": number,
        "y": number,
        "properties": {
          "arrivalInterval": number,
          "processingTime": number,
          "capacity": number,
          "distribution": "constant" | "exponential" | "normal",
          "routeProbability": number,
          "color": "string (hex code)"
        }
      }
    ],
    "connections": [
      {
        "id": "string (unique)",
        "sourceId": "string (matching active node id)",
        "targetId": "string (matching active node id)"
      }
    ]
  },
  "explanation": "string (short description of changes you made)"
}`;

      const userContent = `Current Layout Schema:
${JSON.stringify(currentLayout, null, 2)}

User Instruction Prompt:
"${prompt}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [userContent],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const responseText = response.text || "{}";
      const payload = JSON.parse(responseText);

      res.json(payload);

    } catch (error: any) {
      console.error("Gemini AI Compiler Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate layout via AI." });
    }
  });

  // REST API: Chat endpoint for CTO Copilot
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;

      if (!ai) {
        return res.status(500).json({
          error: "Gemini API client is not initialized. Please ensure your GEMINI_API_KEY is added to Secrets.",
          message: "Chief Architect Copilot is currently offline."
        });
      }

      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const systemInstruction = `You are the lead Software Architect and CTO of NovaSim AI—a next-generation, commercial-grade industrial multi-physics simulation platform designed to compete with ANSYS, COMSOL, and SimScale. 
Your tone is authoritative, highly technical, professional, precise, and concise. Avoid marketing jargon, promotional hype, sales pitch phrases, or emojis unless highly functional.

Core Architectural Decisions to Reference:
1. Vision & Mission: Delivering 1000x faster feedback using hybrid execution and deep neural surrogates, while preserving deterministic solvers.
2. Dual-Engine Solvers: Smooth transitions between raw double-precision numerical solvers (Finite Element Method - FEA, Finite Volume Method - CFD, SPH) and fast AI physics surrogates (Fourier Neural Operators, GNNs).
3. Tech Stack cohabitation:
   - High-performance Solver Core: C++23, CUDA, OpenMP for L1/L2 cache locality, AVX-512 vectorization, and direct GPU runtime access.
   - System Orchestrator: Rust 2024 for race-free concurrency and secure multi-threaded orchestration.
   - User script sandboxing: WebAssembly (Wasmtime runtime), restricting heap to 128MB, limiting execution instructions (fuel), and completely blocking network/disk.
4. File Format (.nsim): Custom compressed container based on HDF5 specification with a dynamic index table enabling O(1) random access seeks to any time-step.
5. Direct GPU memory interop: CUDA/Vulkan (or CUDA/WebGPU) interop using VK_KHR_external_memory, maintaining physics states directly in VRAM to achieve 40x speedups by bypassing CPU-PCIe copies.
6. Custom Slab Allocator (SlabAlloc): Allocates an aligned massive contiguous RAM block (e.g., 8GB) on boot, resolving sub-allocations in O(1) with zero fragmentation and zero runtime malloc locks.
7. Licensing: Node-locked cryptographic hardware signature checking (using CPUID, Motherboard, and MAC hashes signed via RSA-4096), combined with offline floating check mechanisms.
8. AI Integration: Fourier Neural Operators (FNO) trained offline, compiled to TensorRT/ONNX. Local LLM parsing "Simulation Prompts" to compile boundaries and configurations.
9. Cluster Scalability: Metis graph mesh partitioning, streaming LOD views to client, scaling cloud compute over Infiniband network clusters.

When answering, reference concrete classes (e.g., SimulationCoordinator, ISolver, WasmHostRuntime, PINNSurrogateModel, SlabAllocator) or database schemas (projects_metadata, telemetry_sensors, binary_chunks) to reinforce your design credentials. Maintain absolute clarity. Do not write filler.`;

      const contents = [];
      
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          contents.push({
            role: turn.role === "user" ? "user" : "model",
            parts: [{ text: turn.content }]
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text || "I was unable to formulate an answer.";
      res.json({ text });

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({
        error: error.message || "Internal Server Error during AI execution.",
        message: "The Chief Architect is experiencing technical difficulties. Ensure API key validation."
      });
    }
  });

  // Create WebSocket Server for Real-Time Simulation Sync
  const wss = new WebSocketServer({ noServer: true });

  // Map each WS connection to a server-side active DiscreteEventSimulation instance
  const activeSessions = new Map<WebSocket, {
    layout: SimulationLayout;
    engine: DiscreteEventSimulation | null;
    timer: any | null;
  }>();

  wss.on("connection", (ws) => {
    // Initialize session structure
    activeSessions.set(ws, {
      layout: { nodes: [], connections: [] },
      engine: null,
      timer: null
    });

    ws.on("message", (raw) => {
      try {
        const session = activeSessions.get(ws);
        if (!session) return;

        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case "sync_layout":
            session.layout = data.layout;
            // Stop existing simulation if any
            if (session.timer) {
              clearInterval(session.timer);
              session.timer = null;
            }
            // Load a fresh simulation engine
            session.engine = new DiscreteEventSimulation(data.layout, 42);
            ws.send(JSON.stringify({ type: "sim_state_changed", state: "Created" }));
            break;

          case "sim_start":
            if (!session.engine) {
              session.engine = new DiscreteEventSimulation(session.layout, 42);
            }
            session.engine.state = "Running";

            // Clear old loops
            if (session.timer) clearInterval(session.timer);

            // Establish real-time discrete event tick dispatcher
            session.timer = setInterval(() => {
              const eng = session.engine;
              if (eng && eng.state === "Running") {
                const keepGoing = eng.step();
                const summary = eng.getSummary();

                ws.send(JSON.stringify({
                  type: "sim_tick",
                  summary: summary
                }));

                if (!keepGoing) {
                  clearInterval(session.timer);
                  session.timer = null;
                  ws.send(JSON.stringify({ type: "sim_state_changed", state: "Completed" }));
                }
              }
            }, 100); // 100ms ticks

            ws.send(JSON.stringify({ type: "sim_state_changed", state: "Running" }));
            break;

          case "sim_pause":
            if (session.engine) {
              session.engine.state = "Paused";
            }
            if (session.timer) {
              clearInterval(session.timer);
              session.timer = null;
            }
            ws.send(JSON.stringify({ type: "sim_state_changed", state: "Paused" }));
            break;

          case "sim_reset":
            if (session.timer) {
              clearInterval(session.timer);
              session.timer = null;
            }
            session.engine = new DiscreteEventSimulation(session.layout, 42);
            ws.send(JSON.stringify({ type: "sim_state_changed", state: "Created" }));
            
            // Send initial variables summary
            ws.send(JSON.stringify({
              type: "sim_tick",
              summary: session.engine.getSummary()
            }));
            break;

          case "sim_step":
            if (session.engine) {
              session.engine.step();
              ws.send(JSON.stringify({
                type: "sim_tick",
                summary: session.engine.getSummary()
              }));
            }
            break;
        }
      } catch (e: any) {
        logger.error("WS Message handling error:", e, "WEBSOCKETS");
      }
    });

    ws.on("close", () => {
      const session = activeSessions.get(ws);
      if (session && session.timer) {
        clearInterval(session.timer);
      }
      activeSessions.delete(ws);
    });
  });

  // Handle connection upgrades to websockets under '/ws'
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
    
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server booted and listening on http://localhost:${PORT}`, "SYSTEM");
  });
}

startServer();
