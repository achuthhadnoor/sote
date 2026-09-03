import React from "react";
import { useVaultStore } from "../../stores/useVaultStore";
import { FileTree } from "./FileTree";

export const Sidebar: React.FC = () => {
  const { vaultPath, tree, isLoading, error, openVaultDialog } = useVaultStore();

  const folderName = vaultPath ? vaultPath.split("/").pop() || vaultPath : null;

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

      <div className="sidebar-tree-container">
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

      <div className="sidebar-footer">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--muted-fg)", flexShrink: 0 }}>
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" opacity="0.14" />
            <path d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          {folderName ?? "Library"}
        </span>
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
      </div>
    </aside>
  );
};
