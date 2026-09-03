import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createDecorations(doc: any, searchTerm: string, activeIndex: number): DecorationSet {
  if (!searchTerm) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  const regex = new RegExp(escapeRegExp(searchTerm), "gi");
  let matchCount = 0;

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    const text = node.text as string;
    let m: RegExpExecArray | null;
    // reset lastIndex for each node
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const from = pos + m.index;
      const to = from + m[0].length;
      const isActive = matchCount === activeIndex;
      const cls = isActive ? "search-highlight search-highlight-active" : "search-highlight";
      decorations.push(Decoration.inline(from, to, { class: cls }));
      matchCount++;
      // prevent infinite loop on zero-length matches
      if (m[0].length === 0) regex.lastIndex++;
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const searchHighlightPluginKey = new PluginKey("searchHighlight");

export const SearchHighlight = Extension.create<{
  searchTerm: string;
  activeIndex: number;
}>({
  name: "searchHighlight",

  addOptions() {
    return {
      searchTerm: "",
      activeIndex: 0,
    };
  },

  addStorage() {
    return {
      searchTerm: "",
      activeIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            tr.setMeta(searchHighlightPluginKey, { searchTerm, activeIndex: 0 });
            // also update storage for external access
            this.storage.searchTerm = searchTerm;
            this.storage.activeIndex = 0;
          }
          return true;
        },
      setSearchActiveIndex:
        (activeIndex: number) =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            const currentTerm = this.storage.searchTerm;
            tr.setMeta(searchHighlightPluginKey, { searchTerm: currentTerm, activeIndex });
            this.storage.activeIndex = activeIndex;
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            tr.setMeta(searchHighlightPluginKey, { searchTerm: "", activeIndex: 0 });
            this.storage.searchTerm = "";
            this.storage.activeIndex = 0;
          }
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: searchHighlightPluginKey,
        state: {
          init(_: any, { doc }: any) {
            extension.storage.searchTerm = extension.options.searchTerm;
            extension.storage.activeIndex = extension.options.activeIndex;
            return createDecorations(doc, extension.storage.searchTerm, extension.storage.activeIndex);
          },
          apply(tr: any, oldState: any, _oldEditorState: any, newEditorState: any) {
            const meta = tr.getMeta(searchHighlightPluginKey) as
              | { searchTerm?: string; activeIndex?: number }
              | undefined;
            let searchTerm = extension.storage.searchTerm;
            let activeIndex = extension.storage.activeIndex;
            let hasMeta = false;
            if (meta) {
              if (typeof meta.searchTerm === "string") {
                searchTerm = meta.searchTerm;
                extension.storage.searchTerm = searchTerm;
                hasMeta = true;
              }
              if (typeof meta.activeIndex === "number") {
                activeIndex = meta.activeIndex;
                extension.storage.activeIndex = activeIndex;
                hasMeta = true;
              }
              // If meta provided searchTerm but not activeIndex, reset active to 0
              if (meta.searchTerm !== undefined && meta.activeIndex === undefined) {
                activeIndex = 0;
                extension.storage.activeIndex = 0;
              }
            }
            if (tr.docChanged || hasMeta) {
              return createDecorations(newEditorState.doc, searchTerm, activeIndex);
            }
            return oldState.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state: any) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
