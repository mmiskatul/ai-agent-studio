export function isUnauthorizedRequestError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("invalid bearer token") ||
    message.includes("missing bearer token") ||
    message.includes("unauthorized")
  );
}

export async function withUnauthorizedRetry<T>(
  request: (accessToken: string) => Promise<T>,
  accessToken: string,
  refreshAccessToken?: () => Promise<string | null>,
) {
  try {
    return await request(accessToken);
  } catch (error) {
    if (!refreshAccessToken || !isUnauthorizedRequestError(error)) {
      throw error;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }

    return request(refreshedToken);
  }
}
