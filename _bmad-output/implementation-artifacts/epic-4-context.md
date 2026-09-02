# Epic 4 Context: Fast Keyboard Navigation & Document Insights

## Purpose
Deliver keyboard-centric navigation and ambient writing insights for Snipnote:
1. `⌘P` Command Palette with fuzzy search across all vault markdown files for instantaneous file switching.
2. Tab history navigation stack with Back (`⌘[`) and Forward (`⌘]`) navigation.
3. Live document statistics (words, characters, paragraphs) calculated from Tiptap and displayed in the Status Bar.

## Architectural Spine & Design Alignment
- **UX-DR6 (Command Palette)**:
  - Triggered globally by `⌘P` / `Ctrl+P` or Escape to close.
  - Centered floating dialog (`520px` width, `8px` border radius, subtle drop shadow, frosted overlay).
  - Fast client-side fuzzy searching against flattened vault notes (`name` and relative `path`).
  - Keyboard navigation: ArrowUp/ArrowDown to select, Enter to open and close palette.
- **Tab History Stack**:
  - `useTabStore` keeps `history: string[]` and `historyIndex: number`.
  - Traversable via Back/Forward controls and `⌘[` / `⌘]`.
- **UX-DR5 (Status Bar)**:
  - 28px bottom status bar displaying `{words} words · {chars} characters · {paragraphs} paragraphs`.
  - Real-time updates as user writes in Tiptap editor without lag.

## Stories in Epic 4
- **Story 4.1: Command Palette & Fuzzy Search**
- **Story 4.2: Tab History Navigation Stack**
- **Story 4.3: Live Document Statistics & Status Bar**
