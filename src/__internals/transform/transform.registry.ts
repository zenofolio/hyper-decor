import { Request, Response } from "hyper-express";

export interface TransformContext<T = any, S = any> {
  data: T;
  schema: S;
  options: any;
  req: Request;
  res: Response;
  from: string;
}

export type TransformHandler<T = any, S = any> = (ctx: TransformContext<T, S>) => any | Promise<any>;

export interface ITransformer<T = any, S = any> {
  transform: TransformHandler<T, S>;
  getOpenApiSchema?: (schema: S) => any;
}

export type TransformerInput = TransformHandler | ITransformer;

const TRANSFORM_REGISTRY_INSTANCE = Symbol.for("hyper:transform-registry");
const globalRegistry = globalThis as any;

class TransformRegistry {
  private transformers: ITransformer[] = [];

  constructor() {
    if (globalRegistry[TRANSFORM_REGISTRY_INSTANCE]) {
      return globalRegistry[TRANSFORM_REGISTRY_INSTANCE];
    }
    globalRegistry[TRANSFORM_REGISTRY_INSTANCE] = this;
  }

  /**
   * Register a transformer (function or object with transform method).
   */
  register(input: TransformerInput) {
    if (typeof input === 'function') {
      this.transformers.push({ transform: input });
    } else {
      this.transformers.push(input);
    }
  }

  /**
   * Iterates through registered transformers to process the data.
   * Returns the transformed data or the original data if no transformer matched.
   */
  async resolve(ctx: TransformContext): Promise<any> {
    let currentData = ctx.data;
    
    for (const transformer of this.transformers) {
      const result = await transformer.transform({ ...ctx, data: currentData });
      // If transformer returns non-undefined, we assume it's the new data (or unchanged but recognized)
      if (result !== undefined) {
        currentData = result;
      }
    }

    return currentData;
  }

  /**
   * Queries transformers to get an OpenAPI schema representation.
   */
  getOpenApiSchema(schema: any): any | undefined {
    for (const transformer of this.transformers) {
      if (transformer.getOpenApiSchema) {
        const result = transformer.getOpenApiSchema(schema);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }
}

export const transformRegistry = new TransformRegistry();
