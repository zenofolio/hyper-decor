import "reflect-metadata";
import { Request, Response } from "hyper-express";
import { HyperMeta } from "./metadata";

export interface PassOptions {
  (req: Request, res: Response): boolean | Promise<boolean>;
}

/**
 * 🚀 Pass Decorator
 * Purely injects pass metadata into the target class or method.
 */
export const Pass = (options: PassOptions | boolean = true): any =>
  (target: any, propertyKey?: string | symbol) => {
    HyperMeta.set(target, propertyKey, { pass: options });
  };
