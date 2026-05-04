import { AppTree } from "../tree/tree";

export type CollectorType = "class" | "method" | "param";
export type CollectorFn = (target: any, propertyKey?: string) => any;
export type TreeProcessorFn = (tree: AppTree) => void;

const OPENAPI_REGISTRY_INSTANCE = Symbol.for("hyper:openapi-registry");
const globalRegistry = globalThis as any;

class OpenAPIMetadataRegistry {
  private collectors: Record<CollectorType, Set<CollectorFn>> = {
    class: new Set(),
    method: new Set(),
    param: new Set(),
  };

  private processors: Set<TreeProcessorFn> = new Set();

  constructor() {
    if (globalRegistry[OPENAPI_REGISTRY_INSTANCE]) {
      return globalRegistry[OPENAPI_REGISTRY_INSTANCE];
    }
    globalRegistry[OPENAPI_REGISTRY_INSTANCE] = this;
  }

  /**
   * Register a custom metadata collector.
   * @param type The level where the collector operates.
   * @param collector The function that extracts metadata.
   */
  registerCollector(type: CollectorType, collector: CollectorFn) {
    this.collectors[type].add(collector);
  }

  /**
   * Register a processor to transform the final AppTree.
   * @param processor The function that enriches the tree.
   */
  registerProcessor(processor: TreeProcessorFn) {
    this.processors.add(processor);
  }

  /**
   * Returns all registered collectors for a specific type.
   */
  getCollectors(type: CollectorType): CollectorFn[] {
    return Array.from(this.collectors[type]);
  }

  /**
   * Returns all registered tree processors.
   */
  getProcessors(): TreeProcessorFn[] {
    return Array.from(this.processors);
  }
}

export const openApiRegistry = new OpenAPIMetadataRegistry();
