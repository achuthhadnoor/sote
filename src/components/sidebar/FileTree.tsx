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

const FolderIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className="tree-icon tree-folder-icon"
    aria-hidden="true"
  >
    {open ? (
      // folder open
      <path
        d="M3 7.5a2.5 2.5 0 0 1 2.5-2.5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-10Z"
        fill="currentColor"
        opacity="0.14"
      />
    ) : (
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z"
        fill="currentColor"
        opacity="0.14"
      />
    )}
    <path
      d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {open && (
      <path
        d="M3 9.5H21"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
    )}
  </svg>
);

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md" || ext === "markdown";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={`tree-icon tree-file-icon ${isMd ? "is-md" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M7 3.5A1.5 1.5 0 0 1 8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16Z"
        fill="currentColor"
        opacity="0.10"
      />
      <path
        d="M8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16A1.5 1.5 0 0 1 8.5 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2.5V6.5H18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* lines hint — md files get 3 lines */}
      <path
        d="M10 13H15M10 16H14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity={isMd ? 0.9 : 0.35}
      />
      {isMd && (
        <path
          d="M10 10H13"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity={0.9}
        />
      )}
    </svg>
  );
};

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    className={`tree-chevron-icon ${open ? "is-open" : ""}`}
    aria-hidden="true"
  >
    <path
      d="M9 6L15 12L9 18"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
          title={node.path}
        >
          <span className="tree-chevron">
            <ChevronIcon open={isOpen} />
          </span>
          <FolderIcon open={isOpen} />
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
      <span className="tree-file-indent" aria-hidden="true" />
      <FileIcon name={node.name} />
      <span className="tree-name">{node.name}</span>
    </div>
  );
};
