import pg from "pg";
import { Logger } from "../../shared/logging/Logger";

const { Pool } = pg;

export class PostgresClient {
  private static instance: PostgresClient | null = null;
  private pool: pg.Pool | null = null;
  private logger = Logger.getInstance();

  private constructor() {
    this.initPool();
  }

  public static getInstance(): PostgresClient {
    if (!PostgresClient.instance) {
      PostgresClient.instance = new PostgresClient();
    }
    return PostgresClient.instance;
  }

  private initPool() {
    const connectionString = process.env.DATABASE_URL;
    const host = process.env.POSTGRES_HOST || process.env.DB_HOST;

    if (connectionString || host) {
      try {
        this.pool = new Pool({
          connectionString: connectionString,
          host: host,
          port: parseInt(process.env.POSTGRES_PORT || "5432"),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB || "novasim_ai",
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        this.logger.info("PostgreSQL client pool initialized successfully.", "DATABASE");
      } catch (err: any) {
        this.logger.error("Failed to initialize PostgreSQL connection pool.", err, "DATABASE");
        this.pool = null;
      }
    } else {
      this.logger.warn(
        "No PostgreSQL configuration found in env (DATABASE_URL or POSTGRES_HOST is missing). Running in local disk fallback mode.",
        "DATABASE"
      );
      this.pool = null;
    }
  }

  public getPool(): pg.Pool | null {
    return this.pool;
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  /**
   * Run startup migrations to ensure schemas are ready.
   */
  public async runMigrations(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      this.logger.info("Checking and running PostgreSQL database migrations...", "DATABASE");
      
      // Create Projects Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          last_saved VARCHAR(100) NOT NULL,
          layout JSONB NOT NULL,
          versions JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create Users / Sessions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          role VARCHAR(50) NOT NULL,
          token_hash VARCHAR(255),
          last_login TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      this.logger.info("PostgreSQL database migrations applied successfully.", "DATABASE");
    } catch (err: any) {
      this.logger.error("Error running database migrations", err, "DATABASE");
      throw err;
    } finally {
      client.release();
    }
  }
}
