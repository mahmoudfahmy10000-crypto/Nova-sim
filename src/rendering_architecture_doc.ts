import { ArchitectureSection } from "./architecture_doc";

export const RENDERING_ARCHITECTURE_SECTIONS: ArchitectureSection[] = [
  {
    id: "render-pipeline-ecs",
    title: "21. GPU Pipeline, ECS & Spatial Culling",
    category: "3D Graphics Engine",
    shortDescription: "Core WebGPU/Native graphics architecture, Entity Component System (ECS), spatial hierarchies, frustum/occlusion culling, and batching algorithms (Topics 1-10).",
    markdown: `# 21. GPU Pipeline, ECS & Spatial Culling

This document defines the underlying architecture of the NovaSim AI 3D Graphics Engine, engineered to render factories containing millions of components at a locked 60+ FPS on client workstations.

---

## 21.1 Core Rendering Architecture & Pipelines (Topics 1 & 2)

### 1. Purpose
Provides a modern, low-level abstraction over physical graphics APIs (WebGPU for browsers, Vulkan/DirectX12 for native environments) that bypasses driver overhead and supports asynchronous, multi-threaded command recording.

### 2. Internal Architecture
The engine operates on a stateless, command-buffer-driven framework. The CPU schedules draw instructions by building immutable **Render Bundles** and submitting them via dynamic ring buffers directly to the GPU.
* **Render Pipeline States (RPS)**: Cached pipelines compiling WGSL/SPIR-V shaders with fixed-function state configurations (blend modes, rasterizer states, depth-stencil tests) to prevent runtime state mutations.

### 3. Data Structures
\`\`\`cpp
struct PipelineStateDescriptor {
    UUID shader_id;
    PrimitiveTopology topology; // TriangleList, LineList, etc.
    DepthStencilState depth_stencil;
    BlendState blend;
    VertexInputLayout vertex_layout;
};

struct DrawCommand {
    uint32_t vertex_count;
    uint32_t instance_count;
    uint32_t first_vertex;
    uint32_t first_instance;
    GPUBufferRange vertex_buffer;
    GPUBufferRange index_buffer;
    GPUBindGroup bind_groups[4];
};
\`\`\`

### 4. Algorithms
* **Command Buffer Recording**: Leverages worker threads to record commands concurrently into thread-local \`CommandEncoder\` pools, merging them into a unified execution queue submitted to the rendering context.

### 5. Performance Strategy & Scalability
* **No State Backtracking**: Sorts draw calls globally by \`PipelineID\` and \`BindGroupID\` to minimize bind operations and eliminate pipeline stalls.
* **Scalability**: Seamlessly scales from standard web canvases to multi-GPU high-performance clusters.

### 6. Memory Usage
Pre-allocates ring-buffers for uniforms and storage resources (e.g., a 64MB transient frame buffer) to avoid CPU-to-GPU synchronization fences.

### 7. AI Integration
AI models analyze execution times of specific render passes, dynamically adjusting resource allocations (e.g., downscaling render target resolutions during heavy computations).

### 8. Risks
WebGPU context loss can occur if the GPU takes longer than 4ms on a single compute pass.
* *Mitigation*: Restrict compute shader workloads to uniform grid chunks.

### 9. Best Practices
Avoid compiling shaders during active simulation frames. Pre-compile all variants during application load times.

---

## 21.2 Spatial Scene Graph & ECS (Topics 3 & 4)

### 1. Purpose
Manages millions of logical simulation assets without compromising CPU cache locality or layout update speeds.

### 2. Internal Architecture
An **Entity Component System (ECS)** stores kinematic and rendering attributes in contiguous memory arrays, decoupled from the hierarchical relationships managed by the **Spatial Scene Graph**.
* **ECS Transform System**: Processes entity movements.
* **Scene Graph**: Resolves joint attachments and nested groupings (e.g., placing an AMR inside a moving lift).

\`\`\`
+-------------------------------------------------------------+
|                     ECS DATA STRUCT                         |
+-------------------------------------------------------------+
| Entity IDs:   [ 001 ]       [ 002 ]       [ 003 ]           |
| Transforms:   [ X,Y,Z ]     [ X,Y,Z ]     [ X,Y,Z ]  <Contig|
| RenderMeshes: [ MeshA ]     [ MeshB ]     [ MeshA ]  <Memory|
+-------------------------------------------------------------+
\`\`\`

### 3. Data Structures
\`\`\`cpp
// Contiguous component pools
struct TransformComponent {
    float position[3];
    float rotation[4]; // Quaternion representation
    float scale[3];
};

struct HierarchyNode {
    EntityID parent;
    EntityID first_child;
    EntityID next_sibling;
    float local_matrix[16];
    float world_matrix[16];
};
\`\`\`

### 4. Algorithms
* **SIMD Matrix Multiplications**: Worker threads sweep contiguous \`TransformComponent\` arrays, updating \`world_matrix\` variables in parallel using SIMD intrinsics.

### 5. Performance Strategy
Data structures are structured as **Arrays of Structures (AoS)** mapped to CPU L1/L2 caches to maximize instruction throughput.

### 6. AI Integration
AI models identify static layout groups and automatically merge sub-trees into single static assets.

---

## 21.3 Level of Detail (LOD) & Advanced Culling (Topics 5, 6 & 7)

### 1. Purpose
Eliminates overhead by preventing the processing and rendering of off-screen or micro-scale elements.

### 2. Internal Architecture
* **Dynamic LOD Controller**: Adjusts the mesh complexity of distant machines or operators based on screen-space coverage.
* **Hierarchical Z-Buffer Occlusion Culling (HZB)**: Projects a low-resolution depth buffer from the previous frame to the GPU, allowing compute shaders to discard objects hidden behind walls or massive storage racks.

\`\`\`
       [ Camera View Frustum ]
                /   \\\\
               /  [ Occluder Wall ]
              /       |
             /        |  <-- Discards distant objects behind wall
            /         v
           /     [ Hidden AMR ] (Occluded)
          /
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct HZBMipmap {
    GPUTexture depth_pyramid;
    uint32_t width;
    uint32_t height;
    uint32_t mip_levels;
};

struct CullingInstanceInput {
    float bounding_sphere[4]; // vec3 center + float radius
    uint32_t instance_id;
};
\`\`\`

### 4. Algorithms
* **GPU Compute Shader Frustum Sweep**: Compares bounding spheres against the active view frustum planes. Discarded IDs are filtered out, and visible IDs are written directly to an indirect draw argument buffer.

### 5. Best Practices
Avoid executing CPU-side readbacks for culling decisions. Keep the entire pipeline on the GPU, writing directly to indirect draw buffers.

---

## 21.4 GPU Instancing & Draw Batching (Topics 8, 9 & 10)

### 1. Purpose
Consolidates redundant draw commands for identical components (e.g., hundreds of identical rollers on conveyor lines) into a single GPU draw call.

### 2. Internal Architecture
* **Static Batching**: Merges static geometries (like structural factory pillars) into unified, pre-allocated GPU vertex buffers during load-time.
* **Dynamic Batching**: Packs transient variables (e.g., dynamic positions of moving operators) into dynamic Uniform/Storage buffers, submitting them in batches of up to 4096 instances per draw call.

### 3. Data Structures
\`\`\`cpp
struct InstanceData {
    float transform_matrix[16];
    float color_modifier[4];
    float material_properties[4]; // Metalness, roughness, emission, etc.
};
\`\`\`

### 4. Performance Strategy
Utilizes \`drawIndexedIndirect\` calls. GPU compute shaders handle frustum culling, occlusion audits, and lod level selection, writing the resulting instance counts directly to the indirect draw buffers to bypass CPU processing.
`
  },
  {
    id: "render-materials-lighting",
    title: "22. PBR Materials, Lighting & Shadows",
    category: "3D Graphics Engine",
    shortDescription: "Physically Based Rendering (PBR) systems, real-time lighting calculations, shadow mapping arrays, and global illumination (Topics 11-20).",
    markdown: `# 22. PBR Materials, Lighting & Shadows

This specification covers the physics-based lighting model and shader architectures that deliver photorealistic industrial visualizers.

---

## 22.1 Mesh System, Shader Design & Materials (Topics 11, 12 & 13)

### 1. Purpose
Defines how high-fidelity CAD geometry is loaded, compiled, and shaded at runtime.

### 2. Internal Architecture
* **Indexed Vertex Layout**: Vertices are stored in unified buffers using half-precision floats for positions and oct-encoded normals to reduce memory consumption by 50%.
* **Uber-Shader Architecture**: A comprehensive shader pipeline supports multiple material configurations via dynamic branch evaluation, eliminating compilation pauses.

\`\`\`
       [ CAD Asset ] -> [ Mesh Compiler ] -> [ Compressed Vertex Buffer ]
                                              (Half-precision, Oct-encoded normals)
                                                      |
                                                      v
                                        [ PBR Uber-Shader Pipeline ]
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct Vertex {
    float16_t position[3];
    uint32_t normal_oct;     // 2x 16-bit oct-encoded vectors packed into 32-bit
    uint16_t tex_coords[2];  // Half-precision UV mappings
    uint8_t joint_indices[4];
    uint8_t joint_weights[4];
};
\`\`\`

---

## 22.2 Physically Based Rendering (PBR) & Lighting (Topic 14, 15 & 16)

### 1. Purpose
Renders realistic metallic and dielectric surfaces under dynamic industrial lighting setups.

### 2. Internal Architecture
Uses the **Cook-Torrance Microfacet BRDF Model** with Disney-style parameters:
* **D (Normal Distribution Function)**: Trowbridge-Reitz GGX.
* **G (Geometric Shadowing Function)**: Smith Joint GGX.
* **F (Fresnel Reflectance)**: Schlick's approximation.

### 3. Data Structures
\`\`\`cpp
struct PBRMaterialParameters {
    float albedo_factor[4];
    float metallic_roughness_emissive[4]; // r=metal, g=rough, b=emissive
    uint32_t albedo_map_idx;
    uint32_t normal_map_idx;
    uint32_t physical_map_idx; // AO, Roughness, Metalness packed
};

struct LightSource {
    float position_or_direction[4];
    float color_and_intensity[4];
    uint32_t light_type; // Directional=0, Point=1, Spot=2
    uint32_t shadow_index; // -1 if non-shadow casting
};
\`\`\`

### 4. Algorithms
* **Clustered Deferred Shading**: Divides the screen into a $16\\times16\\times24$ grid of spatial frustum clusters. A compute shader assigns light sources to each cluster, allowing the pixel shader to evaluate lighting only for relevant light sources.

---

## 22.3 Shadow Mapping & Global Illumination (Topics 17, 18, 19 & 20)

### 1. Purpose
Provides spatial depth and contact indicators for factory elements, conveyor setups, and robotic arms.

### 2. Internal Architecture
* **Cascaded Shadow Maps (CSM)**: splits the view frustum into 4 cascades to preserve shadow map resolution near the camera.
* **Spatially Reconstructed Screen Space Ambient Occlusion (SSAO)**: Generates soft contact shadows in crevices and corners, enhancing spatial realism.

\`\`\`
+-----------------------------------------------------------+
|              CASCADED SHADOW MAPS (CSM)                   |
|                                                           |
|       [Camera]                                            |
|          |----Cascade 0 (0-15m)  --> High-res shadow map  |
|          |-------Cascade 1 (15-50m)                       |
|          |----------Cascade 2 (50-150m)                   |
|          |-------------Cascade 3 (150m+) --> Low-res map  |
+-----------------------------------------------------------+
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct ShadowCascade {
    float view_projection[16];
    float split_depth;
    float padding[3];
};

struct LightProbe {
    float position[3];
    float radius;
    float sh_coefficients[27]; // 3rd-order Spherical Harmonics (diffuse GI)
};
\`\`\`

### 4. Algorithms
* **Exponential Variance Shadow Maps (EVSM)**: Eliminates shadow-boundary aliasing by storing exponential depth values, enabling hardware-level linear filtering.

### 5. Best Practices
Execute shadow map rendering using dedicated low-detail proxy geometries rather than full-resolution meshes to save memory and processing power.
`
  },
  {
    id: "render-factory-kinematics",
    title: "23. Factory & Kinematic Asset Rendering",
    category: "3D Graphics Engine",
    shortDescription: "Environmental systems, factory floor procedural generation, conveyor mesh solvers, and robotic kinematic animations (Topics 26-33).",
    markdown: `# 23. Factory & Kinematic Asset Rendering

This document details the procedural and kinematic rendering systems designed specifically for factory environments.

---

## 23.1 Environment, Terrain & Factory Floor Generator (Topics 26, 27, 28 & 29)

### 1. Purpose
Generates high-performance industrial environments, grids, concrete slabs, and outdoor staging areas.

### 2. Internal Architecture
The **Factory Floor Generator** procedures procedural texture arrays directly on the GPU. The concrete grid layout is generated via fragment shaders, bypassing memory-heavy textures.
* **Virtual Texture Terrain**: Procedural terrains are divided into clipmap levels, updating only when the camera shifts positions.

\`\`\`
              +---------------------------------+
              |     CLIPMAP LEVEL 2 (Coarse)    |
              |   +-------------------------+   |
              |   |  CLIPMAP LEVEL 1 (Mid)  |   |
              |   |   +-----------------+   |   |
              |   |   | LEVEL 0 (Fine)  |   |   |
              |   |   |    [ Camera ]   |   |   |
              |   |   +-----------------+   |   |
              |   +-------------------------+   |
              +---------------------------------+
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct FloorGridParameters {
    float grid_line_width;
    float major_grid_spacing;
    float minor_grid_spacing;
    float primary_concrete_color[4];
    float grid_line_color[4];
};
\`\`\`

### 4. Algorithms
* **Anti-Aliased Procedural Grid Shader**: Evaluates derivatives in screen-space (\`fwidth\`) to render grid patterns without aliasing artifacts at steep viewing angles.

---

## 23.2 Conveyor Rendering & Spline Deformation (Topic 30)

### 1. Purpose
Deforms and updates conveyor paths along multi-point bezier splines in real-time.

### 2. Internal Architecture
Conveyors are rendered using **Procedural Spline Extrusion**. The CPU submits spline node positions, and a GPU vertex shader deforms conveyor segments to match the curved paths.

\`\`\`
       [ Spline Points ] ---> [ GPU Buffer ] ---> [ Vertex Shader ]
                                                         |
                                 Deforms Segment Mesh Along Spline Path
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct SplinePoint {
    float position[3];
    float tangent[3];
    float normal[3];
    float distance;
};
\`\`\`

### 4. Algorithms
* **Spline-Deformation Shader**: Samples adjacent spline points from a storage buffer, calculating interpolated frames to orient vertices along the conveyor curve.

---

## 23.3 Kinematic Robotic Arms & Vehicle Rendering (Topics 31 & 32)

### 1. Purpose
Renders multi-joint mechanical arms and automated fleets with low CPU overhead.

### 2. Internal Architecture
Robotic joints are processed using **Dual Quaternion Skinning (DQS)** to eliminate joint-collapse artifacts, maintaining realistic joint movements during complex pick-and-place tasks.

### 3. Data Structures
\`\`\`cpp
struct DualQuaternion {
    float real[4];
    float dual[4];
};

struct RobotJointState {
    DualQuaternion joints[16];
};
\`\`\`

---

## 23.4 Human Worker & Character Animation (Topic 33)

### 1. Purpose
Renders human workers performing tasks (walking, sorting, packing) with fluid motion.

### 2. Internal Architecture
* **Skeletal Animation Compiler**: Deforms worker models using standard linear skinning matrices. Animation frames are stored as flat arrays on the GPU to bypass CPU skinning calculations.
* **Crowd Instancing**: Reuses identical walking and working animations across all workers, applying random time offsets to make crowd movements appear natural.
`
  },
  {
    id: "render-interaction-optimizations",
    title: "24. Diagnostics, Interaction & Multi-Platform",
    category: "3D Graphics Engine",
    shortDescription: "Pixel-accurate picking, measurement tools, section cuts, GPU memory layouts, and API architecture comparisons (Topics 34-50).",
    markdown: `# 24. Diagnostics, Interaction & Multi-Platform

This specification defines the interactive tools, optimization strategies, and multi-platform graphics configurations of the rendering engine.

---

## 24.1 Dynamic Camera Systems & Object Picking (Topics 34, 35, 36 & 37)

### 1. Purpose
Provides responsive camera controls and pixel-perfect entity selection on the 3D canvas.

### 2. Internal Architecture
* **Pixel-Accurate Picking Buffer**: During picking passes, the engine renders all visible entities to an offscreen buffer, writing their unique 32-bit entity IDs directly to the color channels. This allows the CPU to resolve the selected entity instantly by reading the pixel coordinate under the cursor.

\`\`\`
+-----------------------------------------------------------+
|              PIXEL-ACCURATE PICKING BUFFER                |
|                                                           |
|    Viewport:       [ Machine A ]        [ Machine B ]     |
|                         |                    |            |
|    Offscreen Buffer:  [ ID: 104 ]          [ ID: 105 ]    |
|                         |                                 |
|    Cursor Hover ---->  Read pixel: Color = 104            |
|                        Resolve Entity ID = 104 Instantly  |
+-----------------------------------------------------------+
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct PickingFrameBuffer {
    GPUTexture id_target;       // 32-bit unsigned integer color target
    GPUTexture depth_target;    // Matching depth target
};
\`\`\`

---

## 24.2 Selection Highlights, Gizmos & Section Views (Topics 38, 39, 40, 41, 42, 43 & 44)

### 1. Purpose
Provides essential UI visualizers, transformation gizmos, distance measurement indicators, and cross-section clipping planes.

### 2. Internal Architecture
* **Outline Post-Process Pass**: Selected items write unique stencil values. A post-process shader samples the stencil buffer and renders glowing outlines around selected elements.
* **Clipping Plane Shader**: Rejects fragments on the GPU that lie beyond active clipping planes, enabling real-time cross-section views of complex machinery.

\`\`\`
               [ clipping_plane: normal * position + d < 0 ]
                                     |
                Visible Region       |   Culled Region
               =====================>|x x x x x x x x x x x
                                     |
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct ClippingPlane {
    float normal[3];
    float offset;
};
\`\`\`

---

## 24.3 GPU Memory Management & Texture Streaming (Topics 45, 46, 47 & 48)

### 1. Purpose
Prevents VRAM overflow when loading large factory models with extensive, high-resolution textures.

### 2. Internal Architecture
* **Sparse Virtual Textures (SVT)**: Cuts high-resolution textures into small $128\\times128$ tile sheets, loading them into GPU memory only when they are visible to the camera.
* **VRAM Allocator**: Employs custom pool allocators to manage vertex and index buffers, eliminating GPU memory fragmentation during simulation updates.

---

## 24.4 Cross-Platform Comparison & Future Roadmap (Topics 49 & 50)

### 1. Graphics API Comparison Matrix
| Architectural Capability | WebGPU (Browser) | Vulkan 1.3 (Native) | DirectX 12 (Windows) |
| :--- | :--- | :--- | :--- |
| **Platform Target** | Web Browsers, Electron | Linux, Windows, Android | Windows, Xbox |
| **Driver Overhead** | Low (Sanitized Sandbox) | Ultra-Low (Direct hardware control) | Ultra-Low (Console-like efficiency) |
| **Command Submission** | Queue-based commands | Multi-threaded command pools | Multi-threaded command lists |
| **Memory Control** | Explicit via browser safety | Complete manual control | Explicit resource heap management |
| **Ray-Tracing Pipeline** | Future Proposed Extension | Native Ray-Query & Pipelines | DirectX Ray-Tracing (DXR) |

### 2. Future Expansion Roadmap
* **v1.1 (Hardware Ray-Tracing)**: Native hardware ray-tracing support on desktop environments to generate photorealistic reflections and shadows.
* **v1.2 (Neural Mesh Compaction)**: Employs AI models to compress heavy CAD assets, reducing download sizes and memory usage by 90% without loss of detail.
`
  }
];
