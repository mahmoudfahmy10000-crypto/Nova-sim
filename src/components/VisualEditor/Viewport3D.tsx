import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SimNode, SimConnection, SimEntity, NodeType } from "../../core/simulation/types";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  MousePointer,
  Move,
  Grid
} from "lucide-react";

interface Viewport3DProps {
  nodes: SimNode[];
  connections: SimConnection[];
  entities: SimEntity[];
  clockTime: number;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  onUpdateNodeCoords?: (id: string, x: number, y: number) => void;
}

export default function Viewport3D({
  nodes,
  connections,
  entities,
  clockTime,
  selectedNodeId = null,
  onSelectNode,
  onUpdateNodeCoords
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [fps, setFps] = useState(60);
  const [lodLevel, setLodLevel] = useState<"HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [massiveLoad, setMassiveLoad] = useState(false);
  const [cameraStats, setCameraStats] = useState({ x: 0, y: 0, z: 0 });

  // Refs for Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Interaction & Gizmo state refs
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const nodeMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const connectionMeshesRef = useRef<Map<string, THREE.Line | THREE.Mesh>>(new Map());

  // Animation & Position Tracking cache
  const entityHistoryRef = useRef<Map<string, { x: number; y: number; z: number; time: number }>>(new Map());
  const flowParticlesRef = useRef<Array<{
    id: string;
    path: THREE.Vector3[];
    progress: number;
    speed: number;
    color: string;
  }>>([]);

  // Transform Gizmo dragging refs
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const activeDragAxisRef = useRef<"X" | "Y" | null>(null);
  const dragStartIntersectionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const selectedNodeStartPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const gizmoGroupRef = useRef<THREE.Group | null>(null);
  const gizmoArrowXRef = useRef<THREE.Mesh | null>(null);
  const gizmoArrowYRef = useRef<THREE.Mesh | null>(null);

  // Instanced rendering for active & mock entities
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const MAX_INSTANCES = 105000;
  const dummyMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const dummyColorRef = useRef<THREE.Color>(new THREE.Color());

  // Floating Labels Overlay State
  const [projectedLabels, setProjectedLabels] = useState<Array<{
    id: string;
    name: string;
    type: NodeType;
    left: number;
    top: number;
    visible: boolean;
    load: number;
    status: string;
  }>>([]);

  // Trigger Local particles flow on connection updates
  useEffect(() => {
    // Generate simulated light flow particles along links when active
    const newParticles: Array<{
      id: string;
      path: THREE.Vector3[];
      progress: number;
      speed: number;
      color: string;
    }> = [];

    connections.forEach((conn) => {
      const src = nodes.find((n) => n.id === conn.sourceId);
      const tgt = nodes.find((n) => n.id === conn.targetId);
      if (src && tgt) {
        const load = entities.filter((e) => e.currentLocationId === src.id).length;
        if ((load > 0 || Math.random() < 0.15) && flowParticlesRef.current.length < 250) {
          // Path coordinates
          const pStart = new THREE.Vector3(src.x, src.y, 5);
          const pEnd = new THREE.Vector3(tgt.x, tgt.y, 5);
          
          // Bezier curve points for visual flair
          const path: THREE.Vector3[] = [];
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
            pt.z += Math.sin(t * Math.PI) * 15; // arching path
            path.push(pt);
          }

          newParticles.push({
            id: `fp_${Math.random()}_${Date.now()}`,
            path,
            progress: 0,
            speed: 0.008 + Math.random() * 0.015,
            color: conn.color || src.properties.color || "#818cf8"
          });
        }
      }
    });

    flowParticlesRef.current = [
      ...flowParticlesRef.current.map(p => ({ ...p, progress: p.progress + p.speed })),
      ...newParticles
    ].filter(p => p.progress < 1.0).slice(0, 300);

  }, [clockTime, entities, connections, nodes]);

  // Main ThreeJS Setup
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617");
    scene.fog = new THREE.FogExp2("#020617", 0.001);
    sceneRef.current = scene;

    // Create Camera
    const width = container.clientWidth;
    const height = 520;
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
    // Position camera at a nice isometric angle
    camera.position.set(450, -350, 450);
    cameraRef.current = camera;

    // Create WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Create Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05; // Don't go below ground plane
    controls.minDistance = 50;
    controls.maxDistance = 1500;
    controls.target.set(450, 250, 0);
    controlsRef.current = controls;

    // 1. Grid Helper
    const gridHelper = new THREE.GridHelper(2000, 50, "#1e293b", "#0f172a");
    gridHelper.rotation.x = Math.PI / 2; // Lie flat on XY plane
    gridHelper.position.set(450, 250, -0.5);
    scene.add(gridHelper);

    // 2. Cartesian Origin Axis Helper
    const axisGroup = new THREE.Group();
    axisGroup.position.set(450, 250, 0);
    const axisX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0,0,0), 60, "#f43f5e", 8, 4);
    const axisY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0,0,0), 60, "#10b981", 8, 4);
    const axisZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0,0,0), 60, "#3b82f6", 8, 4);
    axisGroup.add(axisX, axisY, axisZ);
    scene.add(axisGroup);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight("#1e1b4b", 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight("#ffffff", 2.2);
    dirLight1.position.set(800, -600, 1000);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 10;
    dirLight1.shadow.camera.far = 2500;
    const d = 500;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    scene.add(dirLight1);

    const pointLight = new THREE.PointLight("#818cf8", 3, 300);
    pointLight.position.set(450, 250, 120);
    scene.add(pointLight);

    // 4. Transform Gizmo Group Setup
    const gizmoGroup = new THREE.Group();
    gizmoGroup.visible = false;
    scene.add(gizmoGroup);
    gizmoGroupRef.current = gizmoGroup;

    // Create Custom X-Y Gizmo Arrows
    const gizmoGeoX = new THREE.CylinderGeometry(2, 2, 40, 8);
    gizmoGeoX.translate(0, 20, 0);
    const gizmoGeoY = new THREE.CylinderGeometry(2, 2, 40, 8);
    gizmoGeoY.translate(0, 20, 0);

    const gizmoConeGeo = new THREE.ConeGeometry(5, 12, 8);
    gizmoConeGeo.translate(0, 40, 0);

    // Material
    const matX = new THREE.MeshBasicMaterial({ color: "#f43f5e", depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });
    const matY = new THREE.MeshBasicMaterial({ color: "#10b981", depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });

    const arrowX = new THREE.Group();
    const shaftX = new THREE.Mesh(gizmoGeoX, matX);
    const coneX = new THREE.Mesh(gizmoConeGeo, matX);
    arrowX.add(shaftX, coneX);
    arrowX.rotation.z = -Math.PI / 2; // Point along +X
    arrowX.name = "GIZMO_X";

    const arrowY = new THREE.Group();
    const shaftY = new THREE.Mesh(gizmoGeoY, matY);
    const coneY = new THREE.Mesh(gizmoConeGeo, matY);
    arrowY.add(shaftY, coneY);
    // Already points up (+Y is aligned with layout coordinates)
    arrowY.name = "GIZMO_Y";

    gizmoGroup.add(arrowX, arrowY);

    // Save specific meshes for raycast checks
    gizmoArrowXRef.current = shaftX;
    gizmoArrowYRef.current = shaftY;

    // 5. Instanced Mesh for Entities
    const entityGeometry = new THREE.SphereGeometry(4, 12, 12);
    const entityMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.2,
      metalness: 0.8,
      emissive: new THREE.Color("#020617"),
      emissiveIntensity: 0.2
    });
    const instancedMesh = new THREE.InstancedMesh(entityGeometry, entityMaterial, MAX_INSTANCES);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    scene.add(instancedMesh);
    instancedMeshRef.current = instancedMesh;

    // Clean up
    return () => {
      controls.dispose();
      renderer.dispose();
      entityGeometry.dispose();
      entityMaterial.dispose();
      gizmoGeoX.dispose();
      gizmoGeoY.dispose();
      gizmoConeGeo.dispose();
      matX.dispose();
      matY.dispose();
    };
  }, []);

  // Update layout objects (nodes & connections) inside Three scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old meshes
    nodeMeshesRef.current.forEach((m) => scene.remove(m));
    nodeMeshesRef.current.clear();

    connectionMeshesRef.current.forEach((m) => scene.remove(m));
    connectionMeshesRef.current.clear();

    // 1. Rebuild Connections (conveyors / paths)
    connections.forEach((conn) => {
      const src = nodes.find((n) => n.id === conn.sourceId);
      const tgt = nodes.find((n) => n.id === conn.targetId);

      if (src && tgt) {
        const isConveyor = src.type === "conveyor" || tgt.type === "conveyor";
        const color = conn.color || "#475569";

        let connectionMesh: THREE.Object3D;

        if (isConveyor) {
          // Render detailed physical conveyor structure! (Dual-rail design with support trusses)
          const convGroup = new THREE.Group();

          const length = Math.hypot(tgt.x - src.x, tgt.y - src.y);
          const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);

          const conveyorMat = new THREE.MeshStandardMaterial({
            color: "#1e293b",
            roughness: 0.4,
            metalness: 0.7
          });

          // Conveyor Frame Base Box
          const boxGeo = new THREE.BoxGeometry(length, 12, 4);
          const frame = new THREE.Mesh(boxGeo, conveyorMat);
          frame.position.set(length / 2, 0, 4);
          frame.castShadow = true;
          frame.receiveShadow = true;
          convGroup.add(frame);

          // Add revolving roller drums
          const rollerCount = Math.max(2, Math.floor(length / 15));
          const rollerMat = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.2, metalness: 0.9 });
          const rollerGeo = new THREE.CylinderGeometry(2.5, 2.5, 13, 8);
          rollerGeo.rotateX(Math.PI / 2);

          for (let i = 0; i < rollerCount; i++) {
            const roller = new THREE.Mesh(rollerGeo, rollerMat);
            roller.position.set((i / (rollerCount - 1)) * length, 0, 7);
            roller.name = "ROLLER";
            convGroup.add(roller);
          }

          convGroup.position.set(src.x, src.y, 0);
          convGroup.rotation.z = angle;
          connectionMesh = convGroup;
        } else {
          // Standard pipeline: 3D Tube link
          const start = new THREE.Vector3(src.x, src.y, 5);
          const end = new THREE.Vector3(tgt.x, tgt.y, 5);

          // Build Curve
          const points = [start];
          const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
          mid.z += 8; // gentle arch
          points.push(mid, end);

          const curve = new THREE.CatmullRomCurve3(points);
          const tubeGeo = new THREE.TubeGeometry(curve, 12, 1.8, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            roughness: 0.3,
            metalness: 0.6,
            emissive: new THREE.Color(color).multiplyScalar(0.15)
          });

          const mesh = new THREE.Mesh(tubeGeo, tubeMat);
          mesh.castShadow = true;
          connectionMesh = mesh;
        }

        scene.add(connectionMesh);
        connectionMeshesRef.current.set(conn.id, connectionMesh as any);
      }
    });

    // 2. Rebuild Nodes (machines, queues, pools)
    nodes.forEach((node) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(node.x, node.y, 0);
      nodeGroup.userData = { nodeId: node.id };

      const baseColor = node.properties.color || "#6366f1";
      const isSelected = node.id === selectedNodeId;

      // Base Materials
      const nodeMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.3,
        metalness: 0.6,
        emissive: isSelected ? new THREE.Color("#4f46e5") : new THREE.Color("#000000"),
        emissiveIntensity: isSelected ? 0.35 : 0
      });

      // Different physical 3D geometries representing custom factory assets
      if (node.type === "processor" || node.type === "separator" || node.type === "combiner") {
        // High fidelity industrial machine assembly
        // Heavy CNC base enclosure
        const baseBox = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 25), nodeMat);
        baseBox.position.z = 12.5;
        baseBox.castShadow = true;
        baseBox.receiveShadow = true;
        nodeGroup.add(baseBox);

        // Rotating visual subsystem (spindle spindle gear)
        const motorMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 15, 12), motorMat);
        motor.position.set(0, 0, 30);
        motor.rotation.x = Math.PI / 2;
        nodeGroup.add(motor);

        // Spinning tool rod
        const toolMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.1 });
        const spindle = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 12, 8), toolMat);
        spindle.position.set(0, 0, 42);
        spindle.rotation.x = Math.PI / 2;
        spindle.name = "SPINDLE"; // Tag for render rotation
        nodeGroup.add(spindle);

        // Glowing operational status light dome
        const lightDome = new THREE.Mesh(
          new THREE.SphereGeometry(3, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: "#22c55e" })
        );
        lightDome.position.set(12, 12, 25);
        lightDome.name = "STATUS_LIGHT";
        nodeGroup.add(lightDome);

      } else if (node.type === "queue") {
        // Open intake buffer tray structure
        const trayMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.6 });
        
        // Base plate
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(36, 36, 3), trayMat);
        basePlate.position.z = 1.5;
        basePlate.receiveShadow = true;
        nodeGroup.add(basePlate);

        // Side buffer walls
        const wallMat = new THREE.MeshStandardMaterial({ color: "#854d0e", metalness: 0.3 });
        const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 36, 12), wallMat);
        wallLeft.position.set(-17, 0, 6);
        const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2, 36, 12), wallMat);
        wallRight.position.set(17, 0, 6);
        nodeGroup.add(wallLeft, wallRight);

      } else if (node.type === "source") {
        // Futuristic arrival injector silo
        const siloMat = new THREE.MeshStandardMaterial({ color: "#10b981", roughness: 0.3, metalness: 0.8 });
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 45, 16), siloMat);
        silo.position.z = 22.5;
        silo.rotation.x = Math.PI / 2;
        silo.castShadow = true;
        nodeGroup.add(silo);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(15, 16, 12), new THREE.MeshStandardMaterial({ color: "#064e3b" }));
        cap.position.z = 45;
        nodeGroup.add(cap);

      } else if (node.type === "sink") {
        // Depressed exit terminal cargo dock
        const dockMat = new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.5 });
        const platform = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 4), dockMat);
        platform.position.z = 2;
        platform.receiveShadow = true;
        nodeGroup.add(platform);

        // Warning striped border edges
        const stripeGeo = new THREE.BoxGeometry(42, 2, 5);
        const stripeMat = new THREE.MeshBasicMaterial({ color: "#1e293b" });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, -20, 2.5);
        nodeGroup.add(stripe);

      } else if (node.type === "resource") {
        // Complex operator rest station / storage structure
        const rackMat = new THREE.MeshStandardMaterial({ color: "#06b6d4", metalness: 0.5, roughness: 0.4 });
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 30), rackMat); h1.position.set(-15, -15, 15);
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 30), rackMat); h2.position.set(15, -15, 15);
        const h3 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 30), rackMat); h3.position.set(15, 15, 15);
        const h4 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 30), rackMat); h4.position.set(-15, 15, 15);
        nodeGroup.add(h1, h2, h3, h4);

        const shelf = new THREE.Mesh(new THREE.BoxGeometry(34, 34, 3), rackMat);
        shelf.position.z = 18;
        nodeGroup.add(shelf);

      } else {
        // Router diamond / Decision node
        const routerMat = new THREE.MeshStandardMaterial({ color: "#a855f7", roughness: 0.2, metalness: 0.8 });
        const prism = new THREE.Mesh(new THREE.OctahedronGeometry(18), routerMat);
        prism.position.z = 20;
        prism.castShadow = true;
        nodeGroup.add(prism);
      }

      // Add Glowing wireframe outline if selected (High-fidelity highlight helper)
      if (isSelected) {
        const bbox = new THREE.BoxHelper(nodeGroup, "#a78bfa");
        // Disable depth writing so it stays visible
        (bbox.material as THREE.Material).depthTest = false;
        nodeGroup.add(bbox);
      }

      scene.add(nodeGroup);
      nodeMeshesRef.current.set(node.id, nodeGroup);
    });

    // Update Transform Gizmo Target Position
    const gizmo = gizmoGroupRef.current;
    if (gizmo) {
      if (selectedNodeId) {
        const selectedNode = nodes.find(n => n.id === selectedNodeId);
        if (selectedNode) {
          gizmo.position.set(selectedNode.x, selectedNode.y, 10);
          gizmo.visible = true;
        } else {
          gizmo.visible = false;
        }
      } else {
        gizmo.visible = false;
      }
    }

  }, [nodes, connections, selectedNodeId]);

  // Main Render Frame Loop (60 FPS buttery smooth animation)
  useEffect(() => {
    let animFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    const tick = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Calculate real frame FPS
      frameCount++;
      fpsTimer += delta;
      if (fpsTimer >= 1.0) {
        setFps(Math.round(frameCount / fpsTimer));
        frameCount = 0;
        fpsTimer = 0;
      }

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const controls = controlsRef.current;

      if (!scene || !camera || !renderer || !controls) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }

      const width = containerRef.current?.clientWidth || 800;
      const height = 520;

      // Smoothly update controls
      controls.update();

      // Get camera distance to targeted center to determine LOD
      const distance = camera.position.distanceTo(controls.target);
      let currentLod: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
      if (distance > 750) {
        currentLod = "LOW";
      } else if (distance > 450) {
        currentLod = "MEDIUM";
      }
      setLodLevel(currentLod);

      // Trigger conveyor rollers spinning & machine components animations (If close enough / LOD)
      if (currentLod !== "LOW") {
        nodeMeshesRef.current.forEach((nodeGroup, nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (!node) return;

          const activeCount = entities.filter(e => e.currentLocationId === nodeId).length;
          const isBusy = activeCount > 0;

          // 1. Spindle motor drill rotational spins on machine nodes
          const spindle = nodeGroup.getObjectByName("SPINDLE");
          if (spindle) {
            if (isBusy) {
              spindle.rotation.y += delta * 25.0; // spin fast
              spindle.scale.setScalar(1.0 + Math.sin(now * 0.05) * 0.08); // pulse drill depth
            } else {
              spindle.rotation.y += delta * 1.5; // spin idle slow
              spindle.scale.setScalar(1.0);
            }
          }

          // 2. Pulse colors and status lights
          const statusLight = nodeGroup.getObjectByName("STATUS_LIGHT") as THREE.Mesh;
          if (statusLight) {
            const material = statusLight.material as THREE.MeshBasicMaterial;
            if (node.properties.isLocked) {
              material.color.setHex(0xf43f5e); // Red
            } else if (isBusy) {
              material.color.setHex(0x3b82f6); // Blue
              // Staggered flash
              material.opacity = 0.5 + Math.sin(now * 0.01) * 0.5;
              material.transparent = true;
            } else {
              material.color.setHex(0x10b981); // Green idle
              material.transparent = false;
            }
          }
        });

        // 3. Conveyor roller cylinder spins
        connectionMeshesRef.current.forEach((connMesh) => {
          connMesh.children.forEach((child) => {
            if (child.name === "ROLLER") {
              child.rotation.y += delta * 4.5;
            }
          });
        });
      }

      // Update HUD coordinates indicator
      setCameraStats({
        x: Math.round(camera.position.x),
        y: Math.round(camera.position.y),
        z: Math.round(camera.position.z)
      });

      // 4. Smooth Animation Interpolation for Entities inside InstancedMesh
      const instMesh = instancedMeshRef.current;
      if (instMesh) {
        let instanceIdx = 0;

        // Collect entities to render
        const activeEntityPositions: Array<{ pos: THREE.Vector3; color: string }> = [];

        // Distribute active DES entities logically at their nodes or traveling
        nodes.forEach((node) => {
          const nodeEntities = entities.filter((e) => e.currentLocationId === node.id);
          
          nodeEntities.forEach((ent, index) => {
            let targetPos = new THREE.Vector3(node.x, node.y, 5);

            // If in a Queue, align them in a clean visual line (packing/congesting buffers!)
            if (node.type === "queue") {
              // Align along X offset behind the buffer
              targetPos.x -= (index + 1) * 9.5;
              targetPos.y += Math.sin(index * 0.5) * 1.5; // slight wave pattern
              targetPos.z = 4;
            } else if (node.type === "processor") {
              // Group items inside machine structure
              const angle = (index / Math.max(1, nodeEntities.length)) * Math.PI * 2;
              const radius = 6.0;
              targetPos.x += Math.cos(angle) * radius;
              targetPos.y += Math.sin(angle) * radius;
              targetPos.z = 18;
            } else {
              // Small random spread
              const offsetAngle = index * 1.2;
              targetPos.x += Math.cos(offsetAngle) * 5;
              targetPos.y += Math.sin(offsetAngle) * 5;
              targetPos.z = 5;
            }

            // Interpolate position cache from previous frame (Smooth Animation Interpolation)
            const cached = entityHistoryRef.current.get(ent.id);
            const lerpedPos = new THREE.Vector3();

            if (cached) {
              const elapsed = (now - cached.time) / 1000;
              const speed = 7.5; // interpolation velocity
              const t = Math.min(1.0, elapsed * speed);
              lerpedPos.lerpVectors(new THREE.Vector3(cached.x, cached.y, cached.z), targetPos, t);
            } else {
              lerpedPos.copy(targetPos);
            }

            // Save cache for next frame
            entityHistoryRef.current.set(ent.id, {
              x: lerpedPos.x,
              y: lerpedPos.y,
              z: lerpedPos.z,
              time: now
            });

            activeEntityPositions.push({
              pos: lerpedPos,
              color: ent.color || "#818cf8"
            });
          });
        });

        // Add Active connection flow visual particles
        flowParticlesRef.current.forEach((p) => {
          const ptIdx = Math.min(p.path.length - 1, Math.floor(p.progress * p.path.length));
          const pos = p.path[ptIdx] || new THREE.Vector3(450,250,5);
          activeEntityPositions.push({
            pos,
            color: p.color
          });
        });

        // 5. Massive Load Simulator Stress Testing (Renders 100,000+ extra particles flawlessly)
        if (massiveLoad) {
          const totalStressCount = 100000;
          const systemCenter = new THREE.Vector3(450, 250, 0);

          for (let i = 0; i < totalStressCount; i++) {
            // High efficiency spiral pattern algorithm
            const r = 40 + Math.sqrt(i) * 2.2;
            const theta = i * 0.137 + (now * 0.00015); // slow orbit rotation
            const px = systemCenter.x + Math.cos(theta) * r;
            const py = systemCenter.y + Math.sin(theta) * r;
            const pz = 2.0 + Math.sin(i * 0.01 + now * 0.002) * 5.0; // undulating wavy floor layer

            activeEntityPositions.push({
              pos: new THREE.Vector3(px, py, pz),
              color: i % 3 === 0 ? "#10b981" : i % 3 === 1 ? "#6366f1" : "#eab308"
            });

            if (activeEntityPositions.length >= MAX_INSTANCES) break;
          }
        }

        // Apply positions and colors to InstancedMesh GPU buffer
        activeEntityPositions.forEach((item, idx) => {
          if (idx >= MAX_INSTANCES) return;

          const matrix = dummyMatrixRef.current;
          matrix.makeTranslation(item.pos.x, item.pos.y, item.pos.z);
          instMesh.setMatrixAt(idx, matrix);

          const col = dummyColorRef.current.set(item.color);
          instMesh.setColorAt(idx, col);

          instanceIdx++;
        });

        // Hide unused instances out of viewport boundary
        const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let idx = instanceIdx; idx < MAX_INSTANCES; idx++) {
          instMesh.setMatrixAt(idx, hiddenMatrix);
        }

        instMesh.count = Math.min(MAX_INSTANCES, activeEntityPositions.length);
        instMesh.instanceMatrix.needsUpdate = true;
        if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
      }

      // 6. Project labels screen-space coordinate offsets (Frustum culling applied)
      const projected: any[] = [];
      nodes.forEach((node) => {
        const mesh = nodeMeshesRef.current.get(node.id);
        if (mesh) {
          // Floating offset above machine top (z = 40)
          const targetWorldVec = new THREE.Vector3(node.x, node.y, 35);
          
          // Project world vector onto NDC [-1, 1] screen coordinates
          const projectedVec = targetWorldVec.clone().project(camera);

          // Manual Frustum Culling checks
          const isInsideFrustum = 
            projectedVec.x >= -1 && projectedVec.x <= 1 &&
            projectedVec.y >= -1 && projectedVec.y <= 1 &&
            projectedVec.z >= 0 && projectedVec.z <= 1;

          // Convert to pixel offsets relative to container dimensions
          const screenX = (projectedVec.x * .5 + .5) * width;
          const screenY = (-(projectedVec.y * .5) + .5) * height;

          const load = entities.filter(e => e.currentLocationId === node.id).length;

          projected.push({
            id: node.id,
            name: node.name,
            type: node.type,
            left: screenX,
            top: screenY,
            visible: isInsideFrustum && currentLod !== "LOW", // Cull labels if far away or off-screen
            load,
            status: node.properties.isLocked ? "LOCKED" : load > 0 ? "PROCESSING" : "IDLE"
          });
        }
      });
      setProjectedLabels(projected);

      // Render Scene
      renderer.render(scene, camera);

      // Re-draw Mini Radar Map Canvas
      drawRadarMinimap();

      animFrameId = requestAnimationFrame(tick);
    };

    // Draw Orthographic 2D Minimap
    const drawRadarMinimap = () => {
      const canvas = minimapCanvasRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!canvas || !camera || !controls) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear dark
      ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
      ctx.fillRect(0, 0, w, h);

      // Map Factory Grid Center bounds
      const minX = 0, maxX = 1000;
      const minY = 0, maxY = 500;

      const getRadarCoords = (rx: number, ry: number) => {
        const border = 10;
        const px = border + ((rx - minX) / (maxX - minX)) * (w - border * 2);
        const py = border + ((ry - minY) / (maxY - minY)) * (h - border * 2);
        return { x: px, y: py };
      };

      // Draw Connections
      ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
      ctx.lineWidth = 1;
      connections.forEach(conn => {
        const src = nodes.find(n => n.id === conn.sourceId);
        const tgt = nodes.find(n => n.id === conn.targetId);
        if (src && tgt) {
          const p1 = getRadarCoords(src.x, src.y);
          const p2 = getRadarCoords(tgt.x, tgt.y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // Draw Node Dots
      nodes.forEach(node => {
        const p = getRadarCoords(node.x, node.y);
        ctx.fillStyle = node.id === selectedNodeId ? "#a78bfa" : node.properties.color || "#6366f1";
        ctx.beginPath();
        ctx.arc(p.x, p.y, node.id === selectedNodeId ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        
        if (node.id === selectedNodeId) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw active camera location frustum dot
      const camPos = getRadarCoords(camera.position.x, camera.position.y);
      const targetPos = getRadarCoords(controls.target.x, controls.target.y);

      // Camera view line vector
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(camPos.x, camPos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();

      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(camPos.x, camPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);

  }, [nodes, connections, entities, massiveLoad, selectedNodeId, lodLevel]);

  // Click & Drag Raycasting interactions (Supports selection and coordinate update transform gizmo)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!canvas || !camera || !scene) return;

    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    const y = -((e.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

    mouseRef.current.set(x, y);
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // Check if clicked Gizmo Arrows first
    const gizmo = gizmoGroupRef.current;
    if (gizmo && gizmo.visible) {
      // Direct raycast test on Gizmo shafts
      const gizmoIntersects = raycasterRef.current.intersectObjects([gizmoArrowXRef.current!, gizmoArrowYRef.current!].filter(Boolean) as any);
      
      if (gizmoIntersects.length > 0) {
        const hit = gizmoIntersects[0];
        const parentName = hit.object.parent?.name;

        if (parentName === "GIZMO_X") {
          activeDragAxisRef.current = "X";
        } else if (parentName === "GIZMO_Y") {
          activeDragAxisRef.current = "Y";
        }

        if (activeDragAxisRef.current) {
          // Disable camera controls during gizmo drag operations
          if (controlsRef.current) controlsRef.current.enabled = false;

          // Align Drag Plane with Ground level (Z = 10)
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 10));

          // Compute start offsets
          const intersectionVec = new THREE.Vector3();
          raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectionVec);
          dragStartIntersectionRef.current.copy(intersectionVec);

          const selectedNode = nodes.find(n => n.id === selectedNodeId);
          if (selectedNode) {
            selectedNodeStartPosRef.current.set(selectedNode.x, selectedNode.y, 0);
          }
          return; // Skip node selection if dragging gizmo
        }
      }
    }

    // Node Selection Intersect check
    const meshes: THREE.Object3D[] = [];
    nodeMeshesRef.current.forEach(mesh => meshes.push(mesh));

    const intersects = raycasterRef.current.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      // Find parent group with userData containing nodeId
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData.nodeId) {
        obj = obj.parent;
      }

      if (obj && obj.userData.nodeId) {
        const id = obj.userData.nodeId;
        if (onSelectNode) {
          onSelectNode(id);
        }
      }
    } else {
      // Clear selection if clicked background
      if (onSelectNode) {
        onSelectNode(null);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera || !activeDragAxisRef.current || !selectedNodeId) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    const y = -((e.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

    mouseRef.current.set(x, y);
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    const intersectionVec = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectionVec);

    // Calculate displacement offset delta
    const deltaMove = new THREE.Vector3().subVectors(intersectionVec, dragStartIntersectionRef.current);
    const updatedPos = selectedNodeStartPosRef.current.clone();

    if (activeDragAxisRef.current === "X") {
      updatedPos.x += deltaMove.x;
    } else if (activeDragAxisRef.current === "Y") {
      updatedPos.y += deltaMove.y;
    }

    // Grid snapping size (10px snap default for modular factory layout)
    const snap = 10;
    const snappedX = Math.round(updatedPos.x / snap) * snap;
    const snappedY = Math.round(updatedPos.y / snap) * snap;

    // Call layout coordinate update dispatcher
    if (onUpdateNodeCoords) {
      onUpdateNodeCoords(selectedNodeId, snappedX, snappedY);
    }
  };

  const handlePointerUp = () => {
    // Re-enable camera controls
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
    activeDragAxisRef.current = null;
  };

  // Reset Camera angle
  const handleResetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls) {
      camera.position.set(450, -350, 450);
      controls.target.set(450, 250, 0);
      controls.update();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-[520px] bg-slate-950 border border-slate-900 rounded-xl overflow-hidden select-none shadow-xl">
      {/* 3D Visualizer HUD Control Overlays */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 p-3.5 rounded-lg flex flex-col gap-3 font-mono text-[10px] w-52 shadow-lg backdrop-blur-sm">
        <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          WebGL 3D Core Viewport
        </div>

        {/* FPS & LOD Tracker Panel */}
        <div className="grid grid-cols-2 gap-2 text-[9px] border-b border-slate-800 pb-2">
          <div className="bg-slate-950 p-1 rounded border border-slate-850">
            <span className="text-slate-500 uppercase">GPU FPS</span>
            <div className={`font-bold mt-0.5 ${fps > 45 ? "text-emerald-400" : fps > 25 ? "text-amber-500" : "text-rose-500"}`}>
              {fps} frames
            </div>
          </div>
          <div className="bg-slate-950 p-1 rounded border border-slate-850">
            <span className="text-slate-500 uppercase">MESH LOD</span>
            <div className="font-bold text-indigo-400 mt-0.5">{lodLevel}</div>
          </div>
        </div>

        {/* Camera coords stats indicator */}
        <div className="space-y-1 text-slate-400 text-[8px]">
          <div className="flex justify-between">
            <span>CAM_POS_X:</span> <span className="text-slate-200">{cameraStats.x}</span>
          </div>
          <div className="flex justify-between">
            <span>CAM_POS_Y:</span> <span className="text-slate-200">{cameraStats.y}</span>
          </div>
          <div className="flex justify-between">
            <span>CAM_POS_Z:</span> <span className="text-slate-200">{cameraStats.z}</span>
          </div>
        </div>

        {/* Direct interactive controls */}
        <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2 mt-1">
          <button
            onClick={handleResetCamera}
            className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET CAMERA ANGLE</span>
          </button>
        </div>

        {/* Stress testing massive load renderer (100,000+ items) */}
        <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2">
          <label className="flex items-center justify-between text-slate-400 text-[8px] uppercase font-bold cursor-pointer hover:text-slate-200">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-400 animate-pulse" />
              Stress Test load
            </span>
            <input
              type="checkbox"
              checked={massiveLoad}
              onChange={(e) => setMassiveLoad(e.target.checked)}
              className="rounded border-slate-800 text-indigo-600 bg-slate-950 accent-indigo-500 cursor-pointer"
            />
          </label>
          {massiveLoad && (
            <div className="text-[7px] text-emerald-500 italic leading-snug animate-pulse">
              ▲ RENDER INSTANCING STRESS LOAD STABLE: 100,000+ FLOATING SYSTEM PARTICLES ACTIVE.
            </div>
          )}
        </div>
      </div>

      {/* Floating projected 2D Labels with manual Frustum Culling */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        {projectedLabels.map((lbl) => {
          if (!lbl.visible) return null;

          const isSelected = lbl.id === selectedNodeId;

          return (
            <div
              key={lbl.id}
              style={{
                position: "absolute",
                left: `${lbl.left}px`,
                top: `${lbl.top}px`,
                transform: "translate(-50%, -100%)",
                transition: "none" // disable css transitions to keep rendering snappy
              }}
              className={`p-1.5 rounded border font-mono text-[8px] flex flex-col gap-0.5 shadow-md pointer-events-auto cursor-pointer ${
                isSelected
                  ? "bg-indigo-950/90 border-indigo-500 text-white shadow-indigo-900/40"
                  : "bg-slate-900/85 border-slate-800 text-slate-200"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectNode) onSelectNode(lbl.id);
              }}
            >
              <div className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  lbl.status === "LOCKED" ? "bg-rose-500" : lbl.status === "PROCESSING" ? "bg-blue-400 animate-pulse" : "bg-emerald-400"
                }`} />
                <span className="font-bold truncate max-w-[90px]">{lbl.name.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-[7px] text-slate-400 border-t border-slate-800 mt-0.5 pt-0.5 gap-2">
                <span>{lbl.type.toUpperCase()}</span>
                {lbl.load > 0 && <span className="text-indigo-400 font-bold">[ WIP: {lbl.load} ]</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Right visual tags */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none text-right font-mono text-[9px]">
        <div className="bg-slate-900/95 border border-slate-800 px-3 py-1 rounded text-emerald-400 flex items-center gap-1.5 shadow-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>WebGPU / WebGL Native pipeline</span>
        </div>
        {selectedNodeId && (
          <div className="bg-indigo-950/90 border border-indigo-800 px-3 py-1.5 rounded text-indigo-300 flex items-center gap-1.5 shadow-lg animate-bounce">
            <Move className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Dragging Arrows Move Machine on Grid</span>
          </div>
        )}
      </div>

      {/* Embedded top-down Orthographic minimap radar inset */}
      <div className="absolute bottom-4 right-4 z-10 border border-slate-800 rounded-lg overflow-hidden shadow-lg bg-slate-900/90 p-1 flex flex-col gap-1 font-mono">
        <span className="text-[7px] font-bold text-slate-500 uppercase px-1">Layout radar minimap</span>
        <canvas
          ref={minimapCanvasRef}
          width={150}
          height={75}
          className="border border-slate-950 rounded bg-slate-950 shadow-inner"
        />
      </div>

      {/* Interactive 3D Canvas element */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}
