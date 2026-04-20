import type { Message } from "@/lib/agent-api";

export async function streamChat({
  messages,
  systemPrompt,
  onDelta,
  onDone,
  onError,
}: {
  messages: Pick<Message, "sender_type" | "content">[];
  systemPrompt: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.sender_type === "user");
    const response =
      `This is a frontend-only placeholder response. ` +
      `Connect your future backend to replace this local chat mock.\n\n` +
      `Agent instructions in use:\n${systemPrompt}\n\n` +
      `Your message: ${lastUserMessage?.content ?? ""}`;

    for (const word of response.split(" ")) {
      onDelta(`${word} `);
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : "Failed to generate placeholder response");
  }
}
