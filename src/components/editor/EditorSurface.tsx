import React from "react";

interface EditorSurfaceProps {
  onOpenVault?: () => void;
}

export const EditorSurface: React.FC<EditorSurfaceProps> = ({ onOpenVault }) => {
  return (
    <section className="editor-surface-container">
      <div className="editor-canvas">
        <div className="empty-state">
          <h1 className="empty-title">snipnote</h1>
          <p>The full-size local Markdown companion for Claude Code.</p>
          <button className="btn-primary" onClick={onOpenVault}>
            Open Local Vault
          </button>
        </div>
      </div>
    </section>
  );
};
