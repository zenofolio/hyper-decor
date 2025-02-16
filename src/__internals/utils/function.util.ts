/**
 * Extracts argument names from a function.
 */
export const extreactArgsNames = (
  fn: (...args: any[]) => any
): string[] | null => {
  try {
    const str = fn.toString();
    const args = str
      .slice(str.indexOf("(") + 1, str.indexOf(")"))
      .split(",")
      .map((arg) => arg.trim());
    return args;
  } catch (error) {
    return null;
  }
};
