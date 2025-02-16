

/**
 * 
 * Utility for test
 * @param endpoint 
 * @param body 
 * @returns 
 */
export const request = (endpoint, body?: any) =>
  fetch(`http://0.0.0.0:3001${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then((res) => res.text());
