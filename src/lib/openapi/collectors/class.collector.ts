import "reflect-metadata";
import { TAGS, SECURITY } from "../constants";
import { Tag, SecurityRequirement, Operation } from "../types";
import { collectMethodMetadata } from "./method.collector";
import { extractArgsNames } from "../../../__internals/utils/function.util";
import { openApiRegistry } from "../metadata.registry";

export function collectClassMetadata(target: any) {
  const prototype = Reflect.getPrototypeOf(target);
  const constructor = prototype?.constructor;
  const name = target.name || constructor?.name || target?.constructor?.name;

  // Extraemos las metadata de la clase
  let tags: Tag[] = Reflect.getMetadata(TAGS, target) || [];
  let security: SecurityRequirement[] =
    Reflect.getMetadata(SECURITY, target) || [];

  // Invoke custom class collectors
  openApiRegistry.getCollectors("class").forEach(collector => {
    const data = collector(target);
    if (data?.tags) tags = [...tags, ...data.tags];
    if (data?.security) security = [...security, ...data.security];
  });

  // Si no tenemos tags, intentamos inferirlos
  if (tags.length === 0) {
    tags.push({ name });
  }

  // Si no tenemos seguridad, intentamos asignar un valor predeterminado
  if (security.length === 0) {
    security.push({ bearerAuth: [] });
  }

  // Obtenemos todos los métodos de la clase
  const methodNames: string[] = Object.getOwnPropertyNames(
    target.prototype || {}
  ).filter((method) => method !== "constructor");

  // Creamos una lista con la metadata de cada uno de los métodos
  const methods: { [methodName: string]: Operation } = {};

  methodNames.forEach((methodName) => {
    let methodMetadata = collectMethodMetadata(target.prototype, methodName);

    // Invoke custom method collectors
    openApiRegistry.getCollectors("method").forEach(collector => {
      const data = collector(target.prototype, methodName);
      methodMetadata = { ...methodMetadata, ...data };
    });

    // Si el método no tiene parámetros definidos, intentamos inferirlos
    if (!methodMetadata.parameters || methodMetadata.parameters.length === 0) {
      const methodParams = extractArgsNames(target.prototype[methodName]);

      methodParams?.forEach((paramName, index) => {
        const inferredParam: any = {
          name: paramName || `param${index}`,
          in: "query",
          required: true,
          schema: {
            type: "string",
          },
        };
        methodMetadata.parameters ||= [];
        methodMetadata.parameters.push(inferredParam);
      });
    }

    methods[methodName] = methodMetadata;
  });

  return {
    tags,
    security,
    methods,
  };
}
