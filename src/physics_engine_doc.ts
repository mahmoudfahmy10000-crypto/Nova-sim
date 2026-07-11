import { ArchitectureSection } from "./architecture_doc";

export const PHYSICS_ENGINE_SECTIONS: ArchitectureSection[] = [
  {
    id: "phys-core-collisions",
    title: "25. Physics Core, Collisions & Solvers",
    category: "Industrial Physics Engine",
    shortDescription: "Core architecture of the physics world, rigid bodies, broad-phase/narrow-phase collision systems, and contact resolution solvers (Topics 1-10).",
    markdown: `# 25. Physics Core, Collisions & Solvers

This document specifies the core architecture, spatial partitioning systems, and collision detection pipelines of the NovaSim AI Industrial Physics Engine.

---

## 25.1 Physics Engine Architecture & World Simulation (Topics 1, 2 & 3)

### 1. Purpose
Manages, simulates, and synchronizes the spatial states, collisions, and kinematic reactions of physical objects (packages, vehicles, robotic joints) across the factory floor.

### 2. Internal Design
The Physics Engine uses a sub-stepped, semi-implicit Euler integration scheme decoupled from the graphics render loop. The simulation runs on a high-priority worker thread to ensure deterministic calculations.

\`\`\`
       [ FEL Event / Input ] 
                |
                v
       [ Physics World Tick ] ---> [ Broad-Phase Sweep ] ---> [ Narrow-Phase GJK ]
                ^                                                      |
                |                                                      v
       [ Joint State Update ] <--- [ LCP Impulse Solver ] <--- [ Contact Manifolds ]
\`\`\`

### 3. Mathematical Model
Rigid body state integration over time step \\Delta t:
$$v(t + \\Delta t) = v(t) + M^{-1} F_{\\text{ext}}(t) \\Delta t$$
$$x(t + \\Delta t) = x(t) + v(t + \\Delta t) \\Delta t$$
$$\\omega(t + \\Delta t) = \\omega(t) + I^{-1} (T_{\\text{ext}}(t) - (\\omega(t) \\times I \\omega(t))) \\Delta t$$
$$\\theta(t + \\Delta t) = \\theta(t) \\cdot q(\\omega(t + \\Delta t) \\Delta t)$$

### 4. Data Structures
\`\`\`cpp
struct RigidBody {
    uint64_t entity_id;
    float position[3];
    float orientation[4]; // Quaternion
    float linear_velocity[3];
    float angular_velocity[3];
    float mass;
    float inverse_mass;
    float inertia_tensor[9]; // 3x3 matrix
    float inv_inertia_tensor[9];
    uint32_t collision_layer_mask;
    bool is_kinematic;
    bool is_static;
};
\`\`\`

### 5. Algorithms
* **Semi-Implicit Euler Integration**: Resolves linear and angular velocities before calculating positions to improve numerical energy stability.

### 6. Performance Considerations
* Fits rigid body states into contiguous L3-cache-friendly arrays to maximize SIMD pipeline efficiency.

### 7. Failure Scenarios
* **Numerical Explosion**: Unbound forces (e.g., massive stacked pallets) cause overflow.
* *Mitigation*: Clamp maximum integration delta-velocities to 150 m/s.

### 8. Validation Strategy
* Rigorous unit testing of free-fall motion against known analytical gravitational formulas.

---

## 25.2 Spatial Partitioning & Collision Detection (Topics 4, 5 & 6)

### 1. Purpose
Filters out non-colliding object pairs in O(N log N) time, focusing expensive narrow-phase calculations only on overlapping geometries.

### 2. Internal Design
* **Broad Phase**: Uses an incremental **Axis-Aligned Bounding Box (AABB) Bounding Volume Hierarchy (BVH)** tree.
* **Narrow Phase**: Uses the **Gilbert-Johnson-Keerthi (GJK)** algorithm paired with the **Expanding Polytope Algorithm (EPA)** to generate exact contact manifolds and penetration depths.

### 3. Mathematical Model
Minkowski difference for two convex shapes A and B:
$$A \\ominus B = \\{ x - y \\mid x \\in A, y \\in B \\}$$
Intersection occurs if and only if 0 \\in A \\ominus B.

### 4. Data Structures
\`\`\`cpp
struct BVHNode {
    float min_bounds[3];
    float max_bounds[3];
    uint32_t left_child_index;
    uint32_t right_child_index;
    uint32_t entity_id; // 0xFFFFFFFF if internal node
};

struct ContactPoint {
    float position[3];
    float normal[3]; // Pointing from B to A
    float penetration_depth;
    float impulse_normal;
    float impulse_tangent[2];
};
\`\`\`

---

## 25.3 Continuous Collision Detection & Filtering (Topics 7, 8 & 9)

### 1. Purpose
Prevents fast-moving parts (e.g., small packages on high-speed sorting lanes) from passing through thin sorting boundaries ("tunneling").

### 2. Internal Design
* **Bilateral Swept AABB**: Calculates the exact time of impact (TOI) along active trajectories, backtracking the physics step when a collision is imminent.
* **Collision Layers**: Bitmask-based filtering avoids redundant evaluations (e.g., preventing operators from colliding with structural factory beams).

### 3. Mathematical Model
Linear swept intersection between times [0, \\Delta t]:
$$x_A(t) = x_A + v_A t, \\quad x_B(t) = x_B + v_B t$$
Find minimum t \\in [0, \\Delta t] such that Distance (A(t), B(t)) <= 0.
`
  },
  {
    id: "phys-motion-constraints",
    title: "26. Kinematic Motion, Constraints & Joints",
    category: "Industrial Physics Engine",
    shortDescription: "Rigid body motion equations, joint limits, kinematic constraints, spring-damper couplers, and friction solvers (Topics 11-20).",
    markdown: `# 26. Kinematic Motion, Constraints & Joints

This specification defines the physics solvers responsible for mechanical joint limits, robotic constraints, and industrial contact friction.

---

## 26.1 Linear & Angular Motion constraints (Topics 11, 12 & 13)

### 1. Purpose
Applies kinematic laws to manage physical forces, limits, and spatial attachments between structural elements and components.

### 2. Internal Design
Uses a **Projected Gauss-Seidel (PGS)** solver to resolve velocity constraints. Handled via Lagrange multipliers to compute restorative impulses.

### 3. Mathematical Model
General constraint equation for a multi-body assembly:
$$J v + b = 0$$
where J is the Jacobian matrix, v is the velocity vector, and b is the stabilization bias term (Baumgarte stabilization):
$$b = \\frac{\\beta}{\\Delta t} C + \\phi$$

### 4. Data Structures
\`\`\`cpp
struct VelocityConstraint {
    uint32_t body_index_a;
    uint32_t body_index_b;
    float jacobian_linear_a[3];
    float jacobian_angular_a[3];
    float jacobian_linear_b[3];
    float jacobian_angular_b[3];
    float min_impulse;
    float max_impulse;
    float bias;
    float effective_mass;
};
\`\`\`

---

## 26.2 Industrial Joints, Springs & Friction (Topics 14, 15, 16, 17 & 18)

### 1. Purpose
Models industrial connections such as hinges, sliding rails, dampers, and high-friction contact patches.

### 2. Internal Design
* **Revolute Joint**: Constrains translation to 0, leaving 1 rotational degree of freedom.
* **Prismatic Joint**: Restricts movement along a single linear slide rail.
* **Coulomb Friction Model**: Restricts lateral movement at contact points using a friction cone solver.

\`\`\`
                  ^ Normal Force (Fn)
                  |
                  |     /  Friction Cone (F_tangent <= mu * Fn)
                  |    /
                  |   /
                  |  /
    ==============+==============> Tangent Surface
\`\`\`

### 3. Mathematical Model
Coulomb friction limits for tangential impulse \\lambda_t relative to normal impulse \\lambda_n:
$$|\\lambda_t| \\le \\mu \\lambda_n$$
For dampening and spring systems, the force equation is:
$$F_s = -k_{\\text{spring}} x - d_{\\text{damping}} v$$

### 4. Failure Scenarios
* **Joint Jitter**: Occurs when multiple conflicting joints lock together in closed kinematic loops.
* *Mitigation*: Employ a global **Warm Starting** technique that applies impulses from the previous frame to seed the current iterative solver.

### 5. Future Expansion
Integrate hydraulic and pneumatic pressure variables to simulate exact machine cylinder movements.
`
  },
  {
    id: "phys-industrial-systems",
    title: "27. Material Handling & Vehicle Dynamics",
    category: "Industrial Physics Engine",
    shortDescription: "Specialized physics modeling for conveyors, high-speed sorting mechanisms, lifts, forklifts, and AMRs (Topics 21-30).",
    markdown: `# 27. Material Handling & Vehicle Dynamics

This document details the specialized physics engines, friction models, and navigation dynamics created for logistics systems.

---

## 27.1 Conveyor, Roller & Belt Physics (Topics 21, 22, 23 & 24)

### 1. Purpose
Simulates high-speed package friction, merging collisions, accumulation pressures, and rolling resistance on sorting systems.

### 2. Internal Design
Instead of performing resource-intensive rigid-body calculations for thousands of rollers, we use a **1D Contact Velocity Field**. This field projects conveyor speed vectors directly onto resting objects, resolving friction forces efficiently.

\`\`\`
              [ Dynamic Package ]  --> Translates via Friction Coupling
             =====================
             OOOOOOOOOOOOOOOOOOOOO  --> Conveyor Speed Vector Fields (1D)
\`\`\`

### 3. Mathematical Model
The friction force F_c applied to an object on a conveyor with belt velocity vector v_b and object velocity v_o:
$$F_c = \\mu_c \\cdot m \\cdot g \\cdot \\operatorname{normalize}(v_b - v_o)$$
When accumulating behind a barrier, packages transmit kinetic forces downstream:
$$F_{\\text{total}} = \\sum_{i=1}^{N} F_{\\text{friction}, i}$$

### 4. Data Structures
\`\`\`cpp
struct ConveyorCell {
    float spline_tangent[3];
    float speed;
    float static_friction;
    float dynamic_friction;
    bool is_accumulating;
};
\`\`\`

---

## 27.2 Mobile Vehicles, Forklifts & AMR Navigation (Topics 25, 26, 27, 28, 29 & 30)

### 1. Purpose
Models multi-wheel traction, load balancing, payload stabilization, and collision zones for autonomous industrial vehicles.

### 2. Internal Design
* **Suspension & Wheel Contacts**: Uses a 4-point raycast suspension model to track wheel grip and calculate roll risks when carrying heavy overhead cargo.
* **AMR Social Force Navigation**: Computes repulsive force fields around obstacles, operators, and other vehicles to plan safe navigation routes.

\`\`\`
        [ Vehicle Core ]
          /    |    \\
    Raycast Wheels with Suspensions
       |       |       |
      [g]     [g]     [g] ---> Calculates vertical ground forces
\`\`\`

### 3. Mathematical Model
Social force field calculation for AMR navigation:
$$F_{\\text{total}} = F_{\\text{goal}} + \\sum_{j \\in \\text{obstacles}} F_{\\text{repulsive}, j}$$
$$F_{\\text{repulsive}, j} = A \\exp\\left( \\frac{r_{ij} - d_{ij}}{B} \\right) n_{ij}$$
where d_ij is the distance to the obstacle and r_ij is the safety clearance radius.
`
  },
  {
    id: "phys-factory-solvers",
    title: "28. Factory Systems, Equipment & GPU Solvers",
    category: "Industrial Physics Engine",
    shortDescription: "Storage racks, safety zones, sensors, multi-threaded CPU/GPU acceleration, and numerical stability configurations (Topics 31-50).",
    markdown: `# 28. Factory Systems, Equipment & GPU Solvers

This specification establishes the structural limits, sensor interactions, and high-performance computing pipelines of the physics engine.

---

## 28.1 Storage Racks, Pallets & Safety Zones (Topics 31 - 44)

### 1. Purpose
Simulates weight limit limits, stacking mechanics, laser-sensor zones, and emergency stops on active assembly lines.

### 2. Internal Design
* **Deformation Sensors**: Racks monitor cumulative vertical weight vectors, trigger structural sagging visualizers, and fire warnings if weight ratings are exceeded.
* **Safety Laser Scanners**: Emits procedural 2D sweep rings. If an object breaks the beam boundary, the sensor broadcasts a stop command to nearby AMRs and robotic arms.

\`\`\`
       [ Robotic Cell ] <====== [ Emergency Stop Bus ]
               ^                     ^
               |                     |  <-- Tripped!
       [ Safety Scanner ] ---------> [ Violation Event ]
         * * * * * * * *
         *   [ Human ]  *  <-- Enters safety sweep zone
\`\`\`

### 3. Data Structures
\`\`\`cpp
struct SafetyZone {
    float center[3];
    float radius;
    float angular_sweep_range[2]; // Min and Max angles
    uint32_t registered_violations_count;
    bool is_tripped;
};
\`\`\`

---

## 28.2 Multi-Threaded Solvers & GPU Acceleration (Topics 45 - 50)

### 1. Purpose
Accelerates physics computations to allow real-time simulations of massive factories containing millions of moving elements.

### 2. Internal Design
The engine utilizes a hybrid **CPU-GPU Solver**:
* **CPU Worker Threads**: Processes complex joint chains and kinematics for robotic arms.
* **GPU Compute Shaders**: Calculates collision sweeps, gravity integrations, and conveyor friction grids for mass logistics arrays.

### 3. Data Structures
\`\`\`cpp
struct GPUSolverInput {
    uint32_t total_rigid_bodies;
    float gravity[3];
    float delta_time;
};
\`\`\`

### 4. Algorithms
* **GPU Spatial Grid Hash**: Maps rigid body coordinates to a 3D hash table, resolving broad-phase overlaps in parallel using compute shaders.

### 5. Numerical Stability Configurations
To prevent numerical drift, the constraint solver runs a fixed number of PGS iterations (12 velocity iterations, 4 position correction sweeps) and locks the time step to exactly 0.01 s.
`
  }
];
