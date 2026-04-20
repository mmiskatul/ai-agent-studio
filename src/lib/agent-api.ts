import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Agent = Tables<"agents">;
export type AgentInsert = TablesInsert<"agents">;
export type AgentUpdate = TablesUpdate<"agents">;
export type Chat = Tables<"chats">;
export type Message = Tables<"messages">;

export async function fetchAgents() {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAgent(id: string) {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAgent(agent: Omit<AgentInsert, "user_id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("agents")
    .insert({ ...agent, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAgent(id: string, updates: AgentUpdate) {
  const { data, error } = await supabase
    .from("agents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAgent(id: string) {
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) throw error;
}

export async function getOrCreateChat(agentId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("chats")
    .select("*")
    .eq("agent_id", agentId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("chats")
    .insert({ agent_id: agentId, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMessages(chatId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addMessage(chatId: string, senderType: "user" | "assistant", content: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, sender_type: senderType, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}
