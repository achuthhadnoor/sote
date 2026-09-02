import React, { useState } from "react";
import { VaultNode } from "../../types/vault";
import { useTabStore } from "../../stores/useTabStore";

interface FileTreeProps {
  nodes: VaultNode[];
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, level = 0 }) => {
  return (
    <div className="file-tree" style={{ paddingLeft: level > 0 ? 12 : 0 }}>
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} />
      ))}
    </div>
  );
};

interface FileTreeNodeProps {
  node: VaultNode;
  level: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);

  if (node.isDirectory) {
    return (
      <div className="tree-dir-item">
        <div
          className="tree-row tree-dir-row"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="tree-chevron">{isOpen ? "▾" : "▸"}</span>
          <span className="tree-name">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <FileTree nodes={node.children} level={level + 1} />
        )}
      </div>
    );
  }

  const isActive = activePath === node.path;

  return (
    <div
      className={`tree-row tree-file-row ${isActive ? "active-row" : ""}`}
      onClick={() => selectNote(node.path, node.name)}
      title={node.path}
    >
      <span className="tree-file-dot" />
      <span className="tree-name">{node.name}</span>
    </div>
  );
};
