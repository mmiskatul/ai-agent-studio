export interface LLMEngineOption {
  value: string;
  label: string;
}

export interface LLMEngineOptionsResponse {
  default_engine: string;
  engines: LLMEngineOption[];
}

export async function fetchLLMEngineOptions() {
  const response = await fetch("/backend/api/v1/agents/llm-engines");
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail || "Failed to load LLM engines");
  }

  return body as LLMEngineOptionsResponse;
}
