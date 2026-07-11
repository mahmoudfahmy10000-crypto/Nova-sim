import fs from "fs";
import path from "path";
import { Project } from "../../domain/entities/Project";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { Logger } from "../../shared/logging/Logger";

export class LocalFileProjectRepository implements IProjectRepository {
  private filePath: string;
  private logger = Logger.getInstance();

  constructor() {
    this.filePath = path.join(process.cwd(), "project_db.json");
    this.ensureFileExists();
  }

  private ensureFileExists() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
      } catch (err: any) {
        this.logger.error("Failed to create local database seed file", err, "LOCAL-FILE-DB");
      }
    }
  }

  public async getProjects(): Promise<Project[]> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed && typeof parsed === "object") {
          if ("nodes" in parsed && "connections" in parsed) {
            return [
              {
                id: "proj_default",
                name: "Standard Factory Assembly",
                description: "Classic 3-stage CNC factory milling line with deterministic arrival rates.",
                lastSaved: new Date().toISOString(),
                layout: parsed as any,
                versions: []
              }
            ];
          } else if (parsed.id) {
            return [parsed as Project];
          }
        }
      }
    } catch (err: any) {
      this.logger.error("Error reading projects from local storage", err, "LOCAL-FILE-DB");
    }
    return [];
  }

  public async getProjectById(id: string): Promise<Project | null> {
    const list = await this.getProjects();
    return list.find((p) => p.id === id) || null;
  }

  public async saveProject(project: Project): Promise<void> {
    try {
      const list = await this.getProjects();
      const index = list.findIndex((p) => p.id === project.id);
      
      if (index >= 0) {
        list[index] = {
          ...project,
          lastSaved: new Date().toISOString()
        };
      } else {
        list.push({
          ...project,
          lastSaved: new Date().toISOString()
        });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), "utf-8");
      this.logger.info(`Saved project '${project.name}' to local database.`, "LOCAL-FILE-DB");
    } catch (err: any) {
      this.logger.error("Failed to save project to local database", err, "LOCAL-FILE-DB");
      throw err;
    }
  }

  public async deleteProject(id: string): Promise<void> {
    try {
      const list = await this.getProjects();
      const filtered = list.filter((p) => p.id !== id);
      fs.writeFileSync(this.filePath, JSON.stringify(filtered, null, 2), "utf-8");
      this.logger.info(`Deleted project id '${id}' from local storage.`, "LOCAL-FILE-DB");
    } catch (err: any) {
      this.logger.error("Failed to delete project from local storage", err, "LOCAL-FILE-DB");
      throw err;
    }
  }
}
