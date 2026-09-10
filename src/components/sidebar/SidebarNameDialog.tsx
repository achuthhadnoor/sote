import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebarActionsStore } from "../../stores/useSidebarActionsStore";
import { useVaultStore } from "../../stores/useVaultStore";
import {
  commitCreate,
  commitRename,
  commitSaveDraft,
  listVaultFolders,
} from "../../utils/nativeContextMenu";
import { cn } from "@/lib/utils";

function dialogCopy(dialog: NonNullable<ReturnType<typeof useSidebarActionsStore.getState>["dialog"]>) {
  switch (dialog.mode) {
    case "rename":
      return {
        title: dialog.isDirectory ? "Rename Folder" : "Rename File",
        description: dialog.isDirectory
          ? "Enter a new name for this folder."
          : "Enter a new name for this file.",
        label: "Name",
        confirm: "Rename",
        defaultValue: dialog.name,
        selectExtension: !dialog.isDirectory,
      };
    case "create-file":
      return {
        title: "New File",
        description: "Create a markdown note in this folder.",
        label: "File name",
        confirm: "Create",
        defaultValue: "Untitled.md",
        selectExtension: true,
      };
    case "create-folder":
      return {
        title: "New Folder",
        description: "Create a new folder here.",
        label: "Folder name",
        confirm: "Create",
        defaultValue: "New Folder",
        selectExtension: false,
      };
    case "save-draft":
      return {
        title: "Save Note",
        description: "Choose a name and folder for this draft.",
        label: "Name",
        confirm: "Save",
        defaultValue: dialog.suggestedName,
        selectExtension: true,
      };
  }
}

export const SidebarNameDialog: React.FC = () => {
  const dialog = useSidebarActionsStore((s) => s.dialog);
  const clear = useSidebarActionsStore((s) => s.clear);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const tree = useVaultStore((s) => s.tree);
  const open = dialog !== null;
  const copy = dialog ? dialogCopy(dialog) : null;
  const [value, setValue] = useState("");
  const [dirPath, setDirPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const locationId = useId();

  const folders = useMemo(() => {
    if (!vaultPath) return [];
    return listVaultFolders(tree, vaultPath);
  }, [tree, vaultPath]);

  useEffect(() => {
    if (!dialog) return;
    const next = dialogCopy(dialog);
    setValue(next.defaultValue);
    setDirPath(dialog.mode === "save-draft" ? dialog.dirPath : "");
    setError(null);
    setSubmitting(false);
    const frame = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (next.selectExtension && next.defaultValue.includes(".")) {
        el.setSelectionRange(0, next.defaultValue.lastIndexOf("."));
      } else {
        el.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) clear();
  };

  const submit = async () => {
    if (!dialog || submitting) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Name can’t be empty.");
      return;
    }
    if (/[\\/]/.test(trimmed)) {
      setError("Name can’t contain slashes.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (dialog.mode === "rename") {
        await commitRename(dialog.path, trimmed, dialog.isDirectory);
      } else if (dialog.mode === "create-file") {
        await commitCreate(dialog.dirPath, "file", trimmed);
      } else if (dialog.mode === "create-folder") {
        await commitCreate(dialog.dirPath, "folder", trimmed);
      } else {
        const location = dirPath || dialog.dirPath;
        await commitSaveDraft(
          dialog.draftPath,
          location,
          trimmed,
          dialog.body,
          dialog.frontmatter,
          dialog.resolve
        );
      }
    } catch (e: unknown) {
      const message =
        typeof e === "string"
          ? e
          : e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : String(e);
      setError(message || "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[360px] gap-4 p-5 rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (submitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        {copy && (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">{copy.title}</DialogTitle>
              <DialogDescription className="text-[13px]">{copy.description}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <label htmlFor={inputId} className="type-label text-muted-foreground">
                {copy.label}
              </label>
              <Input
                id={inputId}
                ref={inputRef}
                value={value}
                disabled={submitting}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className="h-9 text-[13px] outline-none"
                autoComplete="off"
                spellCheck={false}
              />

              {dialog?.mode === "save-draft" && (
                <div className="grid gap-2 pt-1">
                  <label htmlFor={locationId} className="type-label text-muted-foreground">
                    Location
                  </label>
                  <select
                    id={locationId}
                    value={dirPath}
                    disabled={submitting || folders.length === 0}
                    onChange={(e) => setDirPath(e.target.value)}
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]",
                      "text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                  >
                    {folders.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="text-[12px] text-destructive leading-snug" role="alert">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => clear()}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={submitting} onClick={() => void submit()}>
                {submitting ? "Working…" : copy.confirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
