import "reflect-metadata";
import { PARAMETERS } from "../constants";
import { Parameter } from "../types";
import { extractArgsNames } from "../../../__internals/utils/function.util";

export function collectParameterMetadata(
  target: any,
  methodName: string
): Parameter[] {
  const parameters: Parameter[] =
    Reflect.getMetadata(PARAMETERS, target, methodName) || [];

  const methodParams =
    Reflect.getMetadata("design:paramtypes", target, methodName) || [];

  // Intentamos obtener los nombres de los parámetros utilizando extractArgsNames
  const paramNames = extractArgsNames(target[methodName]);

  // Si no se encuentran parámetros en los metadatos y hay tipos de parámetros disponibles
  if (parameters.length === 0 && methodParams.length > 0) {
    methodParams.forEach((paramType: any, index: number) => {
      const param: Parameter = {
        name: paramNames && paramNames[index] ? paramNames[index] : `param${index}`, // Asignamos nombre genérico o el nombre inferido
        in: "query", // Definir el tipo de parámetro, se puede modificar según sea necesario
        required: true,
        schema: {
          type: paramType.name.toLowerCase(), // Inferimos el tipo del parámetro
        },
      };
      parameters.push(param);
    });
  }

  return parameters;
}
