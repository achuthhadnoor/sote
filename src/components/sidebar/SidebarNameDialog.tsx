import React, { useEffect, useId, useRef, useState } from "react";
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
import { commitCreate, commitRename } from "../../utils/nativeContextMenu";

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
  }
}

export const SidebarNameDialog: React.FC = () => {
  const dialog = useSidebarActionsStore((s) => s.dialog);
  const clear = useSidebarActionsStore((s) => s.clear);
  const open = dialog !== null;
  const copy = dialog ? dialogCopy(dialog) : null;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!dialog) return;
    const next = dialogCopy(dialog);
    setValue(next.defaultValue);
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
      } else {
        await commitCreate(dialog.dirPath, "folder", trimmed);
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
