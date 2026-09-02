import React, { useMemo } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";

export const StatusBar: React.FC = () => {
  const body = useEditorStore((state) => state.body);
  const activePath = useTabStore((state) => state.activePath);

  const stats = useMemo(() => {
    if (!activePath || !body || !body.trim()) {
      return { words: 0, characters: 0, paragraphs: 0 };
    }

    const characters = body.length;
    const words = (body.match(/\S+/g) || []).length;
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0).length;

    return {
      words,
      characters,
      paragraphs: Math.max(paragraphs, words > 0 ? 1 : 0),
    };
  }, [body, activePath]);

  return (
    <footer className="status-bar">
      <span>
        {stats.words} words · {stats.characters} characters · {stats.paragraphs} paragraphs
      </span>
    </footer>
  );
};
