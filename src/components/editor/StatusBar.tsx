import React from "react";

interface StatusBarProps {
  wordCount?: number;
  charCount?: number;
  paragraphCount?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  wordCount = 0,
  charCount = 0,
  paragraphCount = 0,
}) => {
  return (
    <footer className="status-bar">
      <span>
        {wordCount} words | {charCount} characters | {paragraphCount} paragraphs
      </span>
    </footer>
  );
};
