import React from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export const ConflictBanner: React.FC = () => {
  const hasConflict = useEditorStore((state) => state.hasConflict);
  const resolveConflictReload = useEditorStore(
    (state) => state.resolveConflictReload
  );
  const resolveConflictKeepMine = useEditorStore(
    (state) => state.resolveConflictKeepMine
  );
  const activePath = useTabStore((state) => state.activePath);

  if (!hasConflict || !activePath) {
    return null;
  }

  return (
    <div className="mx-6 mt-2.5">
      <Alert className="flex items-center justify-between gap-3 bg-muted-translucent border-border-translucent py-2 px-3 rounded-md">
        <AlertDescription className="flex items-center gap-2 type-chrome font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          File changed on disk
        </AlertDescription>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="h-7 px-3 type-label"
            onClick={() => resolveConflictReload(activePath)}
          >
            Reload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 type-label bg-transparent"
            onClick={() => void resolveConflictKeepMine(activePath)}
          >
            Keep mine
          </Button>
        </div>
      </Alert>
    </div>
  );
};
