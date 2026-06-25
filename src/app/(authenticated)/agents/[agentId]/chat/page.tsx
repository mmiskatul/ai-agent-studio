import { redirect } from "next/navigation";
import { CHATS_ROUTE } from "@/lib/routes";

type AgentChatPageProps = {
  params: Promise<{ agentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgentChatPage({ params, searchParams }: AgentChatPageProps) {
  const { agentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const nextParams = new URLSearchParams();

  nextParams.set("agentId", agentId);

  const name = resolvedSearchParams.name;
  if (typeof name === "string" && name.trim()) {
    nextParams.set("name", name);
  }

  redirect(`${CHATS_ROUTE}?${nextParams.toString()}`);
}
