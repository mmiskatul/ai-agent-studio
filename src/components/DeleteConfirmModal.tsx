import { Button } from "@/components/ui/button";

interface DeleteConfirmModalProps {
  open: boolean;
  agentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmModal({ open, agentName, onConfirm, onCancel, isDeleting }: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-foreground/20" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground">Delete Agent</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{agentName}</strong>? This will also delete all associated chats and messages. This action cannot be undone.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
