export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  category: string;
  message: string;
  metadata?: Record<string, any>;
  error?: Error | { name: string; message: string; stack?: string };
}

export interface ILogger {
  trace(message: string, category?: string, metadata?: Record<string, any>): void;
  debug(message: string, category?: string, metadata?: Record<string, any>): void;
  info(message: string, category?: string, metadata?: Record<string, any>): void;
  warn(message: string, category?: string, metadata?: Record<string, any>): void;
  error(message: string, error?: Error | string, category?: string, metadata?: Record<string, any>): void;
  fatal(message: string, error?: Error | string, category?: string, metadata?: Record<string, any>): void;
}

export class Logger implements ILogger {
  private static instance: Logger | null = null;
  private minLevel: LogLevel = LogLevel.DEBUG;
  private enableConsole: boolean = true;
  private enableRingBuffer: boolean = true;
  private ringBuffer: LogEntry[] = [];
  private ringBufferCapacity: number = 200;
  private subscribers: Array<(entry: LogEntry) => void> = [];

  private readonly LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.TRACE]: "TRACE",
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.INFO]: "INFO",
    [LogLevel.WARN]: "WARN",
    [LogLevel.ERROR]: "ERROR",
    [LogLevel.FATAL]: "FATAL"
  };

  private readonly ANSI_COLORS = {
    reset: "\x1b[0m",
    trace: "\x1b[90m",
    debug: "\x1b[36m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    fatal: "\x1b[35m\x1b[1m",
    category: "\x1b[34m"
  };

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public configure(config: {
    minLevel: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
    enableConsole: boolean;
    enableRingBuffer: boolean;
    ringBufferCapacity: number;
  }): void {
    const levelMap: Record<string, LogLevel> = {
      TRACE: LogLevel.TRACE,
      DEBUG: LogLevel.DEBUG,
      INFO: LogLevel.INFO,
      WARN: LogLevel.WARN,
      ERROR: LogLevel.ERROR,
      FATAL: LogLevel.FATAL
    };
    
    this.minLevel = levelMap[config.minLevel] ?? LogLevel.DEBUG;
    this.enableConsole = config.enableConsole;
    this.enableRingBuffer = config.enableRingBuffer;
    this.ringBufferCapacity = config.ringBufferCapacity;

    if (this.ringBuffer.length > this.ringBufferCapacity) {
      this.ringBuffer = this.ringBuffer.slice(-this.ringBufferCapacity);
    }
  }

  public subscribe(callback: (entry: LogEntry) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  public getRingBuffer(): LogEntry[] {
    return [...this.ringBuffer];
  }

  public clearRingBuffer(): void {
    this.ringBuffer = [];
  }

  private log(
    level: LogLevel,
    message: string,
    category: string = "SYSTEM",
    metadata?: Record<string, any>,
    error?: Error | { name: string; message: string; stack?: string }
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date(),
      level,
      levelName: this.LEVEL_NAMES[level],
      category: category.toUpperCase(),
      message,
      metadata,
      error
    };

    if (this.enableRingBuffer) {
      this.ringBuffer.push(entry);
      if (this.ringBuffer.length > this.ringBufferCapacity) {
        this.ringBuffer.shift();
      }
    }

    if (this.enableConsole) {
      this.writeToConsole(entry);
    }

    for (const sub of this.subscribers) {
      try {
        sub(entry);
      } catch (e) {
        // Safe isolate
      }
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const timeStr = entry.timestamp.toISOString();
    const color = this.getColorForLevel(entry.level);
    const categoryPart = `[${entry.category}]`;
    const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

    if (isBrowser) {
      const levelStyle = this.getBrowserStyleForLevel(entry.level);
      console.log(
        `%c%s %c%s %c%s: %s`,
        "color: #888; font-size: 10px;", timeStr,
        levelStyle, `[${entry.levelName}]`,
        "color: #3b82f6; font-weight: bold;", categoryPart,
        entry.message
      );
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.dir(entry.metadata);
      }
      if (entry.error) {
        console.error(entry.error);
      }
    } else {
      const clr = this.ANSI_COLORS;
      const colLvl = `${color}[${entry.levelName}]${clr.reset}`;
      const colCat = `${clr.category}${categoryPart}${clr.reset}`;
      const metaStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : "";
      
      console.log(`${clr.trace}${timeStr}${clr.reset} ${colLvl} ${colCat} ${entry.message}${metaStr}`);
      if (entry.error) {
        console.error(entry.error);
      }
    }
  }

  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return this.ANSI_COLORS.trace;
      case LogLevel.DEBUG: return this.ANSI_COLORS.debug;
      case LogLevel.INFO: return this.ANSI_COLORS.info;
      case LogLevel.WARN: return this.ANSI_COLORS.warn;
      case LogLevel.ERROR: return this.ANSI_COLORS.error;
      case LogLevel.FATAL: return this.ANSI_COLORS.fatal;
    }
  }

  private getBrowserStyleForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return "color: #6b7280; font-weight: bold;";
      case LogLevel.DEBUG: return "color: #06b6d4; font-weight: bold;";
      case LogLevel.INFO: return "color: #10b981; font-weight: bold;";
      case LogLevel.WARN: return "color: #f59e0b; font-weight: bold;";
      case LogLevel.ERROR: return "color: #ef4444; font-weight: bold;";
      case LogLevel.FATAL: return "color: #ec4899; font-weight: bold; background-color: #fbcfe8; padding: 1px 3px; border-radius: 2px;";
    }
  }

  public trace(message: string, category?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, category, metadata);
  }

  public debug(message: string, category?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, category, metadata);
  }

  public info(message: string, category?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, category, metadata);
  }

  public warn(message: string, category?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, category, metadata);
  }

  public error(message: string, error?: Error | string, category?: string, metadata?: Record<string, any>): void {
    let formattedErr: any = undefined;
    if (error) {
      if (error instanceof Error) {
        formattedErr = { name: error.name, message: error.message, stack: error.stack };
      } else {
        formattedErr = { name: "Error", message: error };
      }
    }
    this.log(LogLevel.ERROR, message, category, metadata, formattedErr);
  }

  public fatal(message: string, error?: Error | string, category?: string, metadata?: Record<string, any>): void {
    let formattedErr: any = undefined;
    if (error) {
      if (error instanceof Error) {
        formattedErr = { name: error.name, message: error.message, stack: error.stack };
      } else {
        formattedErr = { name: "FatalError", message: error };
      }
    }
    this.log(LogLevel.FATAL, message, category, metadata, formattedErr);
  }
}
