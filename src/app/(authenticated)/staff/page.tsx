"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { createStaff, deleteStaff, fetchStaff, type StaffMember } from "@/lib/staff-api";
import { fetchBackendAgents, type Agent } from "@/lib/agent-api";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function StaffPage() {
  const { accessToken, refreshAccessToken, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    assigned_agent_ids: [] as string[],
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
        const [agentData, staffData] = await Promise.all([
          fetchBackendAgents(token, refreshAccessToken),
          fetchStaff(token, refreshAccessToken),
        ]);
        setAgents(agentData);
        setStaff(staffData);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load staff."));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [accessToken, authLoading, refreshAccessToken]);

  function toggleAssignedAgent(agentId: string) {
    setForm((current) => ({
      ...current,
      assigned_agent_ids: current.assigned_agent_ids.includes(agentId)
        ? current.assigned_agent_ids.filter((id) => id !== agentId)
        : [...current.assigned_agent_ids, agentId],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    setSaving(true);
    setError("");
    try {
      const created = await createStaff(form, accessToken, refreshAccessToken);
      setStaff((current) => [created, ...current]);
      setForm({ name: "", email: "", role: "", assigned_agent_ids: [] });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save staff member."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(staffId: string) {
    if (!accessToken) return;
    try {
      await deleteStaff(staffId, accessToken, refreshAccessToken);
      setStaff((current) => current.filter((member) => member.id !== staffId));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete staff member."));
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Staff</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Add staff members and assign them to agent chat workflows.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="staff-role">Role</Label>
              <Input
                id="staff-role"
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Assigned Agents</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.assigned_agent_ids.includes(agent.id)}
                    onChange={() => toggleAssignedAgent(agent.id)}
                  />
                  <span>{agent.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving || !form.name.trim() || !form.email.trim() || !form.role.trim()}
          >
            {saving ? "Saving..." : "Add Staff Member"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading staff...</p>
        ) : staff.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No staff members added yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Chats</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {member.assigned_agent_ids.length === 0
                        ? "No assigned agents"
                        : member.assigned_agent_ids.map((agentId) => {
                            const agent = agents.find((item) => item.id === agentId);
                            return (
                              <a
                                key={agentId}
                                href={agent ? `/agents/${agent.id}/chat` : "#"}
                                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                              >
                                {agent?.name || agentId}
                              </a>
                            );
                          })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive"
                      onClick={() => void handleDelete(member.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
