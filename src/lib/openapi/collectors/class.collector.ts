import "reflect-metadata";
import { TAGS, SECURITY } from "../constants";
import { Tag, SecurityRequirement, Operation } from "../types";
import { collectMethodMetadata } from "./method.collector"; // Importamos el colector de métodos
import { extractArgsNames } from "../../../__internals/utils/function.util";

export function collectClassMetadata(target: any) {
  const prototype = Reflect.getPrototypeOf(target);
  const constructor = prototype?.constructor;
  const name = target.name || constructor?.name || target?.constructor?.name;

  // Extraemos las metadata de la clase
  const tags: Tag[] = Reflect.getMetadata(TAGS, target) || [];
  const security: SecurityRequirement[] =
    Reflect.getMetadata(SECURITY, target) || [];

  // Si no tenemos tags, intentamos inferirlos
  if (tags.length === 0) {
    tags.push({ name }); // El nombre de la clase podría ser un tag
  }

  // Si no tenemos seguridad, intentamos asignar un valor predeterminado
  if (security.length === 0) {
    security.push({ bearerAuth: [] }); // Se puede ajustar según la seguridad predeterminada de la clase
  }

  // Obtenemos todos los métodos de la clase
  const methodNames: string[] = Object.getOwnPropertyNames(
    target.prototype
  ).filter((method) => method !== "constructor");

  // Creamos una lista con la metadata de cada uno de los métodos
  const methods: { [methodName: string]: Operation } = {};

  methodNames.forEach((methodName) => {
    let methodMetadata = collectMethodMetadata(target.prototype, methodName);

    // Si el método no tiene parámetros definidos, intentamos inferirlos
    if (!methodMetadata.parameters || methodMetadata.parameters.length === 0) {
      const methodParams = extractArgsNames(target.prototype[methodName]);

      methodParams?.forEach((paramName, index) => {
        const inferredParam: any = {
          name: paramName || `param${index}`,
          in: "query", // Asignamos por defecto 'query', esto puede mejorarse según el contexto
          required: true,
          schema: {
            type: "string", // Asignamos 'string' por defecto, también mejorable
          },
        };
        methodMetadata.parameters?.push(inferredParam);
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
