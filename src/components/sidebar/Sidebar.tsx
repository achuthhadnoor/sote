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
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
          {folderName ? `📁 ${folderName}` : "Library"}
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
