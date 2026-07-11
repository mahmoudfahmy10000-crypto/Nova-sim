import { Project } from "../../domain/entities/Project";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { PostgresClient } from "../database/PostgresClient";
import { Logger } from "../../shared/logging/Logger";

export class PostgresProjectRepository implements IProjectRepository {
  private client = PostgresClient.getInstance();
  private logger = Logger.getInstance();

  public async getProjects(): Promise<Project[]> {
    const pool = this.client.getPool();
    if (!pool) {
      throw new Error("PostgreSQL pool is uninitialized.");
    }

    try {
      const res = await pool.query(
        "SELECT id, name, description, last_saved as \"lastSaved\", layout, versions FROM projects ORDER BY updated_at DESC"
      );
      return res.rows as Project[];
    } catch (err: any) {
      this.logger.error("Error fetching projects from Postgres", err, "POSTGRES-DB");
      throw err;
    }
  }

  public async getProjectById(id: string): Promise<Project | null> {
    const pool = this.client.getPool();
    if (!pool) {
      throw new Error("PostgreSQL pool is uninitialized.");
    }

    try {
      const res = await pool.query(
        "SELECT id, name, description, last_saved as \"lastSaved\", layout, versions FROM projects WHERE id = $1",
        [id]
      );
      if (res.rowCount === 0) return null;
      return res.rows[0] as Project;
    } catch (err: any) {
      this.logger.error(`Error fetching project by id ${id} from Postgres`, err, "POSTGRES-DB");
      throw err;
    }
  }

  public async saveProject(project: Project): Promise<void> {
    const pool = this.client.getPool();
    if (!pool) {
      throw new Error("PostgreSQL pool is uninitialized.");
    }

    try {
      await pool.query(
        `INSERT INTO projects (id, name, description, last_saved, layout, versions, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           last_saved = EXCLUDED.last_saved,
           layout = EXCLUDED.layout,
           versions = EXCLUDED.versions,
           updated_at = CURRENT_TIMESTAMP`,
        [
          project.id,
          project.name,
          project.description,
          project.lastSaved,
          JSON.stringify(project.layout),
          JSON.stringify(project.versions || [])
        ]
      );
      this.logger.info(`Saved project '${project.name}' successfully in Postgres.`, "POSTGRES-DB");
    } catch (err: any) {
      this.logger.error(`Error saving project id ${project.id} to Postgres`, err, "POSTGRES-DB");
      throw err;
    }
  }

  public async deleteProject(id: string): Promise<void> {
    const pool = this.client.getPool();
    if (!pool) {
      throw new Error("PostgreSQL pool is uninitialized.");
    }

    try {
      await pool.query("DELETE FROM projects WHERE id = $1", [id]);
      this.logger.info(`Deleted project id '${id}' successfully from Postgres.`, "POSTGRES-DB");
    } catch (err: any) {
      this.logger.error(`Error deleting project id ${id} from Postgres`, err, "POSTGRES-DB");
      throw err;
    }
  }
}
