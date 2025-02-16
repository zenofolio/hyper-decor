import "reflect-metadata";

export default function methodTransformer(
  target: any,
  key: string | symbol,
  transfrom?: (...args: any[]) => any
): void {
  const prototype = target.constructor.prototype;
  if (!prototype || prototype.__transformed) return;
  prototype.__transformed = true;

  const original = Reflect.getOwnMetadata(key,target);
  if (!original?.value) return;

  console.log(original, "original");

  original.value = function (...args: any[]) {
    console.log("Before method call", args);
  };

  // const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
  // if(!descriptor) return;

  // console.log(descriptor, "descriptor");
}
