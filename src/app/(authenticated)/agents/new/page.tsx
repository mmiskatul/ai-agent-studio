"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bolt,
  BookOpen,
  Database,
  FileText,
  Save,
  Send,
  Settings2,
  SlidersHorizontal,
  UploadCloud,
  Zap,
} from "lucide-react";
import { createAgent } from "@/lib/agent-api";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tabs = [
  { label: "Setup", icon: SlidersHorizontal },
  { label: "Instructions", icon: BookOpen },
  { label: "Knowledge", icon: Database },
  { label: "Advanced", icon: Bolt },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [templateType, setTemplateType] = useState("blank");
  const [category, setCategory] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Setup");
  const [llmEngine, setLlmEngine] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);

  async function handleCreate(status: string) {
    if (!name.trim() || !purpose.trim()) return;

    setIsSubmitting(true);
    try {
      await createAgent({
        name: name.trim(),
        role: category.trim() || "AgentLab",
        purpose: purpose.trim(),
        template_type: category.trim() || templateType,
        system_prompt:
          systemPrompt.trim() ||
          `You are ${name.trim()}, an AI agent that helps with: ${purpose.trim()}`,
        status,
      });
      router.push(AUTHENTICATED_HOME);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <main className="min-w-0 overflow-y-auto border-r border-border bg-background">
        <header className="flex items-start justify-between gap-4 border-b border-border py-7 pl-10 pr-7">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Agent</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Configure and publish your AI agent.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-lg bg-card px-5"
              disabled={isSubmitting}
              onClick={() => handleCreate("inactive")}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-lg px-5"
              disabled={isSubmitting}
              onClick={() => handleCreate("active")}
            >
              <Save className="h-4 w-4" />
              Publish
            </Button>
          </div>
        </header>

        <div className="border-b border-border py-4 pl-10 pr-7">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.label}
                type="button"
                variant={activeTab === tab.label ? "outline" : "ghost"}
                className={`gap-2 rounded-lg px-4 ${
                  activeTab === tab.label ? "bg-card text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setActiveTab(tab.label)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <section className="max-w-3xl py-8 pl-10 pr-7">
          {activeTab === "Setup" && (
            <div className="space-y-7">
              <div>
                <Label htmlFor="agent-name" className="text-sm font-bold text-foreground">
                  Agent Name
                </Label>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Sales Outreach Bot"
                  className="mt-2 h-12 rounded-lg bg-card"
                />
              </div>

              <div>
                <Label htmlFor="agent-purpose" className="text-sm font-bold text-foreground">
                  Short Description
                </Label>
                <Textarea
                  id="agent-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="What does this agent do?"
                  rows={3}
                  className="mt-2 resize-none rounded-lg bg-card"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-bold text-foreground">Base Template</Label>
                  <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger className="mt-2 h-12 rounded-lg bg-card">
                      <SelectValue placeholder="Blank Canvas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Blank Canvas</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category" className="text-sm font-bold text-foreground">
                    Category Tag
                  </Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="e.g. Operations"
                    className="mt-2 h-12 rounded-lg bg-card"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "Instructions" && (
            <div className="space-y-7">
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-bold text-warning-foreground">
                <Zap className="h-4 w-4 text-warning-foreground" />
                Be specific. Define response format and how to handle unknown queries.
              </div>

              <div>
                <Label htmlFor="system-prompt" className="text-sm font-bold text-foreground">
                  System Prompt
                </Label>
                <Textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  placeholder="You are a helpful AI assistant specialized in..."
                  rows={13}
                  className="mt-2 rounded-lg bg-card font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="welcome-message" className="text-sm font-bold text-foreground">
                  Welcome Message
                </Label>
                <Input
                  id="welcome-message"
                  value={welcomeMessage}
                  onChange={(event) => setWelcomeMessage(event.target.value)}
                  placeholder="First message the agent says..."
                  className="mt-2 h-12 rounded-lg bg-card"
                />
              </div>
            </div>
          )}

          {activeTab === "Knowledge" && (
            <div className="space-y-7">
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 text-sm font-bold text-primary">
                <Database className="h-4 w-4" />
                Upload files the agent will use as context when answering queries.
              </div>

              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Upload Data Source</h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  PDFs, Text, JSON. Max 50MB.
                </p>
                <Button type="button" className="mt-7 rounded-lg px-5">
                  Browse Files
                </Button>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">Attached Files</h3>
                  <span className="text-xs font-bold uppercase text-muted-foreground">1 Item</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                      <FileText className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        sales_playbook_2026.pdf
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        2.4 MB · Indexed
                      </p>
                    </div>
                  </div>

                  <Button type="button" variant="ghost" className="text-destructive">
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Advanced" && (
            <div className="space-y-7">
              <div>
                <Label className="text-sm font-bold text-foreground">LLM Engine</Label>
                <Select value={llmEngine} onValueChange={setLlmEngine}>
                  <SelectTrigger className="mt-2 h-12 rounded-lg bg-card">
                    <SelectValue placeholder="GPT-4o (Premium)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Premium)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                    <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-border bg-card px-6 py-6">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Temperature</h3>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Creativity vs consistency
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold text-foreground shadow-sm">
                    {temperature.toFixed(1)}
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="h-2 w-full accent-primary"
                />

                <div className="mt-7 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <aside className="flex min-h-0 flex-col border-l border-border bg-card">
        <div className="flex h-10 items-center gap-2 border-b border-border px-5">
          <span className="h-2 w-2 rounded-full bg-success" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Live Preview
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Settings2 className="h-4 w-4" />
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm">
              Hi! I&apos;m your agent preview. Ask me anything.
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 shadow-sm">
            <input
              placeholder="Test your agent..."
              className="h-9 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <Button size="icon" className="h-8 w-8 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
            Test chats don&apos;t affect production metrics.
          </p>
        </div>
      </aside>
    </div>
  );
}
