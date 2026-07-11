import { Project } from "../../domain/entities/Project";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { LocalFileProjectRepository } from "../../infrastructure/repositories/LocalFileProjectRepository";
import { PostgresProjectRepository } from "../../infrastructure/repositories/PostgresProjectRepository";
import { PostgresClient } from "../../infrastructure/database/PostgresClient";
import { Logger } from "../../shared/logging/Logger";

export class ProjectService {
  private static instance: ProjectService | null = null;
  private activeRepo: IProjectRepository;
  private logger = Logger.getInstance();

  private constructor() {
    const postgres = PostgresClient.getInstance();
    if (postgres.isConnected()) {
      this.logger.info("ProjectService choosing Postgres database driver as active repository.", "APP-SERVICE");
      this.activeRepo = new PostgresProjectRepository();
    } else {
      this.logger.info("ProjectService choosing Local Disk JSON file as active storage repository.", "APP-SERVICE");
      this.activeRepo = new LocalFileProjectRepository();
    }
  }

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  public async getAllProjects(): Promise<Project[]> {
    try {
      return await this.activeRepo.getProjects();
    } catch (err: any) {
      this.logger.error("Failed to load projects inside ProjectService", err, "APP-SERVICE");
      return [];
    }
  }

  public async getProject(id: string): Promise<Project | null> {
    try {
      return await this.activeRepo.getProjectById(id);
    } catch (err: any) {
      this.logger.error(`Failed to load project with ID ${id}`, err, "APP-SERVICE");
      return null;
    }
  }

  public async saveProject(project: Project): Promise<void> {
    try {
      await this.activeRepo.saveProject(project);
    } catch (err: any) {
      this.logger.error(`Failed to write project with ID ${project.id}`, err, "APP-SERVICE");
      throw err;
    }
  }

  public async removeProject(id: string): Promise<void> {
    try {
      await this.activeRepo.deleteProject(id);
    } catch (err: any) {
      this.logger.error(`Failed to delete project with ID ${id}`, err, "APP-SERVICE");
      throw err;
    }
  }
}
