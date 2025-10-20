export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private context?: string;

  private constructor(context?: string) {
    this.context = context;
    this.level = this.getLogLevelFromEnv();
  }

  public static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'VERBOSE':
        return LogLevel.VERBOSE;
      default:
        return LogLevel.INFO; // 默认级别
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: string,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context || this.context || '';
    const contextPrefix = contextStr ? `[${contextStr}]` : '';
    return `${timestamp} [${level}]${contextPrefix} ${message}`;
  }

  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    context?: string,
    ...args: any[]
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, context);

    if (level === LogLevel.ERROR) {
      console.error(formattedMessage, ...args);
    } else if (level === LogLevel.WARN) {
      console.warn(formattedMessage, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }

  public error(message: string, context?: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context, ...args);
  }

  public warn(message: string, context?: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, context, ...args);
  }

  public info(message: string, context?: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, context, ...args);
  }

  public debug(message: string, context?: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context, ...args);
  }

  public verbose(message: string, context?: string, ...args: any[]): void {
    this.log(LogLevel.VERBOSE, 'VERBOSE', message, context, ...args);
  }
}

// 导出默认实例
export const logger = Logger.getInstance();
