export const extractArgsNames = (
  fn: (...args: any[]) => any,
  replacer = "param"
): string[] | null => {
  try {
    // Convertimos la función en un string
    const str = fn.toString();

    // Usamos una expresión regular para capturar los nombres de los parámetros
    const argNames: string[] = [];
    const regex = /(\w+|\{[^}]+\}|\[[^\]]+\])/g;
    const matches = str
      .slice(str.indexOf("(") + 1, str.indexOf(")"))
      .match(regex);

    // Si se encuentran coincidencias, las filtramos y las limpiamos
    if (matches) {
      matches.forEach((arg, index) => {
        // Si el argumento es desestructurado, asignamos un nombre genérico
        if (arg.includes("{") || arg.includes("[")) {
          argNames.push(`${replacer}${index}`);
        } else {
          argNames.push(arg.trim());
        }
      });
    }

    return argNames.length > 0 ? argNames : null;
  } catch (error) {
    return null;
  }
};
