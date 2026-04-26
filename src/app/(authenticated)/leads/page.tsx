"use client";

import { useEffect, useState } from "react";
import { createLead, fetchLeads, type Lead } from "@/lib/lead-api";
import { fetchBackendAgents, type Agent } from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LeadsPage() {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    agent_id: "",
    name: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    if (authLoading) return;

    async function loadData() {
      const token = accessToken;
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const [agentData, leadData] = await Promise.all([
          fetchBackendAgents(token, refreshAccessToken),
          fetchLeads(token, refreshAccessToken),
        ]);
        setAgents(agentData);
        setLeads(leadData);
        setForm((current) => ({
          ...current,
          agent_id: current.agent_id || agentData[0]?.id || "",
        }));
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load leads."));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [accessToken, authLoading, refreshAccessToken]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    setSaving(true);
    setError("");
    try {
      const created = await createLead(
        {
          agent_id: form.agent_id,
          name: form.name.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
        },
        accessToken,
        refreshAccessToken,
      );
      setLeads((current) => [created, ...current]);
      setForm((current) => ({ ...current, name: "", phone: "", message: "" }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save lead."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Leads</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Capture and review leads linked to your agents.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="lead-agent">Agent</Label>
            <select
              id="lead-agent"
              value={form.agent_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, agent_id: event.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lead-name">Name</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lead-message">Message</Label>
            <Textarea
              id="lead-message"
              value={form.message}
              onChange={(event) =>
                setForm((current) => ({ ...current, message: event.target.value }))
              }
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={
                saving ||
                !form.agent_id ||
                !form.name.trim() ||
                !form.phone.trim() ||
                !form.message.trim()
              }
            >
              {saving ? "Saving..." : "Save Lead"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No leads saved yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{lead.name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>
                    {agents.find((agent) => agent.id === lead.agent_id)?.name || "Unknown"}
                  </TableCell>
                  <TableCell className="max-w-sm truncate">{lead.message}</TableCell>
                  <TableCell>{new Date(lead.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
