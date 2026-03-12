/**
 *
 * Utility for test
 * @param endpoint
 * @param body
 * @returns
 */
export const request = async (endpoint: string, body?: any, port: number = 3001) => {
  const request = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (request.status !== 200) {
    throw new Error(await request.text() ?? "Request failed");
  }

  return request.text();
};
