export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface LoggerInterface {
  error(message: string, context?: string, ...args: any[]): void;
  warn(message: string, context?: string, ...args: any[]): void;
  info(message: string, context?: string, ...args: any[]): void;
  debug(message: string, context?: string, ...args: any[]): void;
  verbose(message: string, context?: string, ...args: any[]): void;
  log(level: LogLevel, message: string, context?: string, ...args: any[]): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: string;
  timestamp?: boolean;
  colorize?: boolean;
}
