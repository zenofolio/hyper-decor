import { singleton } from "tsyringe";

export const LOGGER_TOKEN = Symbol("ILogger");

export interface ILogger {
  info(message: string, ...context: any[]): void;
  warn(message: string, ...context: any[]): void;
  error(message: string, ...context: any[]): void;
  debug(message: string, ...context: any[]): void;
}

@singleton()
export class InternalLogger implements ILogger {
  info(message: string, ...context: any[]) {
    console.info(`[HYPER-INFO] ${message}`, ...context);
  }

  warn(message: string, ...context: any[]) {
    console.warn(`[HYPER-WARN] ${message}`, ...context);
  }

  error(message: string, ...context: any[]) {
    console.error(`[HYPER-ERROR] ${message}`, ...context);
  }

  debug(message: string, ...context: any[]) {
    console.debug(`[HYPER-DEBUG] ${message}`, ...context);
  }
}
