const PROXY_API_PREFIX = "/backend/api/v1";
const DIRECT_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/v1`
  : null;

function shouldRetryWithProxy(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("socket hang up") ||
    message.includes("econnreset")
  );
}

function resolveDirectUrl(input: string) {
  if (!DIRECT_API_BASE || !input.startsWith(PROXY_API_PREFIX)) {
    return null;
  }

  return `${DIRECT_API_BASE}${input.slice(PROXY_API_PREFIX.length)}`;
}

export async function backendFetch(input: string, init?: RequestInit) {
  const directUrl = resolveDirectUrl(input);

  if (directUrl) {
    try {
      return await globalThis.fetch(directUrl, init);
    } catch (error) {
      if (!shouldRetryWithProxy(error)) {
        throw error;
      }
    }
  }

  return globalThis.fetch(input, init);
}
