import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TableNodeView } from "./TableNodeView";

export const CustomTableBlock = Node.create({
  name: "tableBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-raw") || "",
        renderHTML: (attributes) => ({
          "data-raw": attributes.raw,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="table-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "table-block", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableNodeView);
  },

  markdownTokenName: "table",

  parseMarkdown(token: any) {
    return {
      type: "tableBlock",
      attrs: {
        raw: token.raw || "",
      },
    };
  },

  renderMarkdown(node: any) {
    const raw = (node.attrs?.raw || "").trim();
    return raw ? raw + "\n\n" : "";
  },
});
