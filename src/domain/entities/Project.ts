import { SimulationLayout } from "./Simulation";

export interface Version {
  id: string;
  timestamp: string;
  comment: string;
  layout: SimulationLayout;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  lastSaved: string;
  layout: SimulationLayout;
  versions: Version[];
}
