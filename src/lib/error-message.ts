export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export function getChatErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Failed to generate a response. Please try again.");
  const lowered = message.toLowerCase();

  if (lowered.includes("missing bearer token") || lowered.includes("invalid bearer token")) {
    return "Your session expired. Please sign in again.";
  }

  if (lowered.includes("network") || lowered.includes("fetch failed")) {
    return "Could not reach the backend. Check that the API server is running.";
  }

  if (lowered.includes("llm provider") || lowered.includes("openai")) {
    return "The AI provider could not generate a response right now. Please try again.";
  }

  return message;
}
