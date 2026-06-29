const PROXY_API_PREFIX = "/backend/api/v1";
const DIRECT_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/v1`
  : null;

function resolveDirectUrl(input: string) {
  if (!DIRECT_API_BASE || !input.startsWith(PROXY_API_PREFIX)) {
    return null;
  }

  return `${DIRECT_API_BASE}${input.slice(PROXY_API_PREFIX.length)}`;
}

export async function backendFetch(input: string, init?: RequestInit) {
  const directUrl = resolveDirectUrl(input);

  if (directUrl) {
    return globalThis.fetch(directUrl, init);
  }

  return globalThis.fetch(input, init);
}
