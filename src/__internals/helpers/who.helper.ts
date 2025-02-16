import { $constructor } from "../utils/object.util";

export default function who(
  target: any,
  propertyKey?: any,
  descriptorOrIndex?: any
) {
  const isMethod = typeof propertyKey === "string";
  const isProperty = typeof descriptorOrIndex === "number";

  const Target = $constructor(target);
  const Method = isMethod ? Reflect.get(target, propertyKey) : null;

  return {
    isMethod,
    isProperty,
    isClass: !!target && !isMethod && !isProperty,
    Target,
    Method,
    key: propertyKey,
    descriptorOrIndex,
  };
}
