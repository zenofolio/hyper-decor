import { container } from "tsyringe";
import { ImportType } from "../../decorators/types";

/**
 * Prepare imports for the target class.
 *
 * @param target
 * @param imports
 */
export async function prepareImports(target: any, imports: ImportType[]) {
  for (const service of imports) {
    const _class = container.resolve(service);
    if (!_class) continue;

    const isSingleton = _class.isSingleton?.() === true;

    if (isSingleton) {
      if (isInitialized(_class)) continue;
      container.registerInstance(service, _class);
    }

    if (typeof _class.onInit === "function") {
      await _class.onInit();
      if (isSingleton) setInitialized(_class);
    }
  }
}

////////////////////////
/// Utils
////////////////////////

const isInitialized = (target: any) =>
  Reflect.get(target, "____initialized") === true;

const setInitialized = (target: any) =>
  Reflect.set(target, "____initialized", true);
