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

type ApiValidationIssue = {
  loc?: unknown;
  msg?: unknown;
};

type ApiErrorBody = {
  message?: unknown;
  errors?: unknown;
  detail?: unknown;
};

function humanizeFieldName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "purpose" || normalized === "description") return "Purpose";
  if (normalized === "name") return "Agent name";
  if (normalized === "role") return "Role";
  if (normalized === "language") return "Language";
  if (normalized === "system_prompt") return "System prompt";
  return value.replace(/_/g, " ");
}

function formatValidationIssue(issue: ApiValidationIssue) {
  const message = typeof issue.msg === "string" ? issue.msg.trim() : "";
  const location = Array.isArray(issue.loc)
    ? issue.loc
        .filter(
          (part): part is string | number => typeof part === "string" || typeof part === "number",
        )
        .map((part) => (typeof part === "string" ? humanizeFieldName(part) : String(part)))
        .filter((part) => part !== "body" && part !== "query" && part !== "path")
        .join(".")
    : "";

  if (location && message) {
    return `${location}: ${message}`;
  }

  return message;
}

export function getApiErrorMessage(
  detail: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue) =>
        issue && typeof issue === "object"
          ? formatValidationIssue(issue as ApiValidationIssue)
          : "",
      )
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  if (detail && typeof detail === "object") {
    const nestedMessage =
      "message" in detail && typeof detail.message === "string" ? detail.message.trim() : "";
    if (nestedMessage) {
      return nestedMessage;
    }

    const body = detail as ApiErrorBody;
    const structuredIssues = [body.errors, body.detail]
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .map((issue) =>
        issue && typeof issue === "object"
          ? formatValidationIssue(issue as ApiValidationIssue)
          : typeof issue === "string"
            ? issue.trim()
            : "",
      )
      .filter(Boolean);

    if (structuredIssues.length > 0) {
      return structuredIssues.join(" | ");
    }
  }

  return fallback;
}

export function getApiSuccessData<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }

  return body as T;
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
