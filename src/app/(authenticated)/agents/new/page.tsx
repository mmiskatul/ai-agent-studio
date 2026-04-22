"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bolt, ChevronDown, Save, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { generateAgentDescription, generateAgentWelcomeMessage } from "@/lib/agent-generate-api";
import { createBuilderAgent } from "@/lib/builder-agent-api";
import { fetchBackendAgents, type Agent } from "@/lib/agent-api";
import { AUTHENTICATED_HOME } from "@/lib/routes";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildStandardSystemPrompt } from "@/lib/standard-agent-prompt";

const tabs = [
  { label: "Setup", icon: SlidersHorizontal },
  { label: "Advanced", icon: Bolt },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { accessToken, refreshAccessToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingWelcomeMessage, setIsGeneratingWelcomeMessage] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [purposeSource, setPurposeSource] = useState<"manual" | "ai">("manual");
  const [templateType, setTemplateType] = useState("blank");
  const [savedAgents, setSavedAgents] = useState<Agent[]>([]);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Setup");
  const [temperature, setTemperature] = useState(0.7);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  function displayTemplateLabel(option: string) {
    return option === "blank" ? "" : option;
  }

  useEffect(() => {
    async function loadTemplateOptions() {
      if (!accessToken) return;

      try {
        const agents = await fetchBackendAgents(accessToken, refreshAccessToken);
        setSavedAgents(agents);
      } catch (err) {
        console.error("Failed to load template options:", err);
      }
    }

    loadTemplateOptions();
  }, [accessToken, refreshAccessToken]);

  const templateOptions = useMemo(() => {
    const presetOptions = ["blank", "analytics", "sales", "support", "research", "operations"];
    const customOptions = Array.from(
      new Set(
        savedAgents
          .map((agent) => agent.template_type?.trim())
          .filter((value): value is string => Boolean(value) && !presetOptions.includes(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [...presetOptions, ...customOptions];
  }, [savedAgents]);

  const filteredTemplateOptions = useMemo(() => {
    const query = templateType.trim().toLowerCase();
    if (!query || templateType === "blank") {
      return templateOptions;
    }

    return templateOptions.filter((option) => option.toLowerCase().includes(query));
  }, [templateOptions, templateType]);

  async function handleGenerateDescription() {
    if (!name.trim() || !accessToken) return;

    setIsGeneratingDescription(true);
    setError("");
    try {
      const generatedDescription = await generateAgentDescription(
        name.trim(),
        accessToken,
        refreshAccessToken,
      );
      setPurpose(generatedDescription);
      setPurposeSource("ai");
    } catch (err) {
      console.error("Failed to generate description:", err);
      setError(err instanceof Error ? err.message : "Failed to generate description");
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  async function handleGenerateWelcomeMessage() {
    if (!name.trim() || !purpose.trim() || !accessToken) return;

    setIsGeneratingWelcomeMessage(true);
    setError("");
    try {
      const generatedMessage = await generateAgentWelcomeMessage(
        {
          name: name.trim(),
          shortDescription: purpose.trim(),
          categoryTag: templateType,
          baseTemplate: templateType,
        },
        accessToken,
        refreshAccessToken,
      );
      setWelcomeMessage(generatedMessage);
    } catch (err) {
      console.error("Failed to generate welcome message:", err);
      setError(err instanceof Error ? err.message : "Failed to generate welcome message");
    } finally {
      setIsGeneratingWelcomeMessage(false);
    }
  }

  async function handleCreate(status: string) {
    const resolvedTemplateType = templateType.trim();
    if (!name.trim() || !purpose.trim() || !resolvedTemplateType || !accessToken) return;

    setIsSubmitting(true);
    setError("");
    try {
      const resolvedSystemPrompt =
        purposeSource === "ai"
          ? purpose.trim()
          : buildStandardSystemPrompt({
              name,
              role:
                resolvedTemplateType === "blank"
                  ? "AI assistant"
                  : `${resolvedTemplateType} specialist`,
              purpose,
              templateType: resolvedTemplateType,
            });

      await createBuilderAgent(
        {
          name: name.trim(),
          shortDescription: purpose.trim(),
          baseTemplate: resolvedTemplateType,
          categoryTag: resolvedTemplateType,
          systemPrompt: resolvedSystemPrompt,
          welcomeMessage: welcomeMessage.trim() || undefined,
          temperature,
          status,
        },
        accessToken,
        refreshAccessToken,
      );
      router.push(AUTHENTICATED_HOME);
    } catch (err) {
      console.error("Failed to create agent:", err);
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background">
      <main className="h-full min-w-0 overflow-y-auto bg-background">
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

        {error && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-10 py-3 text-sm font-bold text-destructive">
            {error}
          </div>
        )}

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
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="agent-purpose" className="text-sm font-bold text-foreground">
                    Purpose
                  </Label>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg bg-card"
                    title="Generate description"
                    aria-label="Generate description"
                    disabled={!name.trim() || !accessToken || isGeneratingDescription}
                    onClick={handleGenerateDescription}
                  >
                    <Sparkles
                      className={`h-4 w-4 ${isGeneratingDescription ? "animate-pulse" : ""}`}
                    />
                  </Button>
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Describe what the agent should do. A standard system prompt will be generated
                  automatically when you save.
                </p>
                <Textarea
                  id="agent-purpose"
                  value={purpose}
                  onChange={(event) => {
                    setPurpose(event.target.value);
                    setPurposeSource("manual");
                  }}
                  placeholder="Example: Help users answer sales questions, qualify leads, and suggest the next best action."
                  rows={6}
                  className="mt-2 rounded-lg bg-card"
                />
              </div>

              <div>
                <Label className="text-sm font-bold text-foreground">Base Template</Label>
                <div className="relative mt-2 w-full max-w-xs">
                  <Input
                    ref={templateInputRef}
                    value={displayTemplateLabel(templateType)}
                    onChange={(event) => {
                      setTemplateType(event.target.value.trim() ? event.target.value : "blank");
                      setIsTemplateMenuOpen(true);
                    }}
                    onFocus={(event) => {
                      event.currentTarget.select();
                    }}
                    onClick={(event) => {
                      event.currentTarget.select();
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setIsTemplateMenuOpen(false), 120);
                    }}
                    placeholder="Select or type a base template"
                    className="h-10 rounded-lg bg-card pr-9 text-sm"
                  />
                  <button
                    type="button"
                    aria-label="Show template options"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setIsTemplateMenuOpen(true);
                      templateInputRef.current?.focus();
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {isTemplateMenuOpen || !templateType.trim() || templateType === "blank" ? (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-sm">
                      {filteredTemplateOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setTemplateType(option);
                            setIsTemplateMenuOpen(false);
                            templateInputRef.current?.focus();
                          }}
                        >
                          {displayTemplateLabel(option) || "\u00A0"}
                        </button>
                      ))}
                      {filteredTemplateOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Press save to create this new template
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Advanced" && (
            <div className="space-y-7">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="welcome-message" className="text-sm font-bold text-foreground">
                    Welcome Message
                  </Label>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg bg-card"
                    title="Generate welcome message"
                    aria-label="Generate welcome message"
                    disabled={
                      !name.trim() || !purpose.trim() || !accessToken || isGeneratingWelcomeMessage
                    }
                    onClick={handleGenerateWelcomeMessage}
                  >
                    <Sparkles
                      className={`h-4 w-4 ${isGeneratingWelcomeMessage ? "animate-pulse" : ""}`}
                    />
                  </Button>
                </div>
                <Input
                  id="welcome-message"
                  value={welcomeMessage}
                  onChange={(event) => setWelcomeMessage(event.target.value)}
                  placeholder="First message the agent says..."
                  className="mt-2 h-12 rounded-lg bg-card"
                />
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
    </div>
  );
}
