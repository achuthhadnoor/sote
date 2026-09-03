import React, { useState } from "react";
import { useVaultStore } from "../../stores/useVaultStore";
import { FileTree } from "./FileTree";
import { FileContextMenu } from "./FileContextMenu";

interface SidebarProps {
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const { vaultPath, tree, isLoading, error, openVaultDialog } = useVaultStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const folderName = vaultPath ? vaultPath.split("/").pop() || vaultPath : null;

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    // only if clicking on the container itself (empty area below tree)
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Search notes... (⌘P)"
          readOnly
        />
      </div>

      <div className="sidebar-tree-container" onContextMenu={handleEmptyContextMenu}>
        {isLoading && (
          <div className="sidebar-empty-hint">Scanning vault...</div>
        )}

        {error && (
          <div className="sidebar-empty-hint" style={{ color: "var(--destructive)" }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && tree.length === 0 && (
          <div className="sidebar-empty-hint">
            {vaultPath ? (
              "No markdown files found in this vault."
            ) : (
              <>
                No vault opened.<br />
                <button
                  onClick={openVaultDialog}
                  style={{
                    marginTop: "8px",
                    background: "none",
                    border: "none",
                    color: "var(--link)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: "13px",
                  }}
                >
                  Select a folder
                </button>
              </>
            )}
          </div>
        )}

        {!isLoading && tree.length > 0 && <FileTree nodes={tree} />}
      </div>
      {menu && <FileContextMenu node={null} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}

      <div className="sidebar-footer">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--muted-fg)", flexShrink: 0 }}>
              <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" opacity="0.14" />
              <path d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {folderName ?? "Library"}
          </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={openVaultDialog}
            style={{
              background: "none",
              border: "none",
              color: "var(--fg)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
            title={vaultPath || "Open vault"}
          >
            {vaultPath ? "Switch" : "Open..."}
          </button>
          <button
            onClick={() => onOpenSettings?.()}
            title="Settings (⌘,)"
            aria-label="Open settings"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--muted-fg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--hover-translucent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-fg)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M19.4 14.9a7.5 7.5 0 0 0 .1-1.8l1.7-1.3-1.7-3-1.9.4a7.3 7.3 0 0 0-1.6-.9L14.9 6h-3.4L10.2 8.3a7.3 7.3 0 0 0-1.6.9L6.7 8.8l-1.7 3 1.7 1.3a7.5 7.5 0 0 0 .1 1.8L5.1 16.2l1.7 3 1.9-.4c.5.4 1 .7 1.6.9l1.2 2.3h3.4l1.2-2.3c.6-.2 1.1-.5 1.6-.9l1.9.4 1.7-3-1.9-1.3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};
