/**
 *
 * Utility for test
 * @param endpoint
 * @param body
 * @returns
 */
export const request = async (endpoint, body?: any) => {
  const request = await fetch(`http://0.0.0.0:3001${endpoint}`, {
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
