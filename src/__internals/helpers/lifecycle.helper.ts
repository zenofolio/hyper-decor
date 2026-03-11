export const isInitialized = (target: any) =>
  Reflect.get(target, "____initialized") === true;

export const setInitialized = (target: any) =>
  Reflect.set(target, "____initialized", true);

export async function initializeInstance(instance: any) {
  if (instance && typeof instance.onInit === "function" && !isInitialized(instance)) {
    await instance.onInit();
    setInitialized(instance);
  }
}
