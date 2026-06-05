import { redirect } from "next/navigation";
import { CHATS_ROUTE } from "@/lib/routes";

type AgentChatRedirectPageProps = {
  params: Promise<{ agentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgentChatRedirectPage({
  params,
  searchParams,
}: AgentChatRedirectPageProps) {
  const { agentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const nextParams = new URLSearchParams();

  nextParams.set("agentId", agentId);

  const chatId = resolvedSearchParams.chatId;
  const name = resolvedSearchParams.name;

  if (typeof chatId === "string" && chatId.trim()) {
    nextParams.set("chatId", chatId);
  }

  if (typeof name === "string" && name.trim()) {
    nextParams.set("name", name);
  }

  redirect(`${CHATS_ROUTE}?${nextParams.toString()}`);
}
