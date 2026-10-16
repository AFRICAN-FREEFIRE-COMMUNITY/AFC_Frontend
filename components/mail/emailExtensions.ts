// components/mail/emailExtensions.ts
// ─────────────────────────────────────────────────────────────────────────────
// The editor's email-only pieces. The NAMES and ATTRIBUTES here are a contract with the server's
// allowlist, afc_mail/document.py: a node or attribute the server does not list is dropped when the
// draft is saved, so adding one here means adding it there too.
//
//   emailImage       a picture (an AFC asset: `asset` token; `src` is only for showing it here, the
//                    server builds the address itself), width %, opacity, align, description, link
//   designedPicture  a picture drawn from layers (#284), uploaded as a picture; `design` keeps the
//                    layers so it opens again in the designer
//   emailButton      a button: label, link, align
//   emailBlockAttrs  listStyle on lists (1 a A i I, dot circle square) and indent on paragraphs and
//                    headings, with the commands the formatting bar uses
//
// USED BY: components/mail/Composer.tsx (the editor), PickedBar.tsx (options of the picked node).
// ─────────────────────────────────────────────────────────────────────────────
import { Extension, Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emailBlockAttrs: {
      setListStyle: (style: string) => ReturnType;
      indentMore: () => ReturnType;
      indentLess: () => ReturnType;
    };
  }
}

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

const pictureAttrs = {
  asset: { default: null },
  src: { default: null },
  alt: { default: "" },
  width: { default: 100 },
  opacity: { default: 1 },
  align: { default: "center" },
};

function pictureHTML(cls: string, attrs: Record<string, unknown>) {
  const width = num(attrs.width, 10, 100, 100);
  const opacity = num(attrs.opacity, 0.1, 1, 1);
  const img: Record<string, string> = {
    alt: String(attrs.alt ?? ""),
    style: `width:${width}%;opacity:${opacity}`,
    draggable: "false",
  };
  // No address yet (still uploading, or an asset the server no longer has): no <img src> at all,
  // because an empty src makes the browser fetch the page itself.
  if (attrs.src) img.src = String(attrs.src);
  return [
    "div",
    { class: cls, "data-align": String(attrs.align ?? "center"), style: `text-align:${attrs.align ?? "center"}` },
    attrs.src ? ["img", img] : ["span", { class: "email-pic-missing" }, String(attrs.alt || "")],
  ] as const;
}

export const EmailImage = Node.create({
  name: "emailImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { ...pictureAttrs, href: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div.email-pic:not(.designed)" }];
  },
  renderHTML({ HTMLAttributes }) {
    return pictureHTML("email-pic", HTMLAttributes) as unknown as [string, Record<string, string>];
  },
});

export const DesignedPicture = Node.create({
  name: "designedPicture",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { ...pictureAttrs, design: { default: null, rendered: false } };
  },
  parseHTML() {
    return [{ tag: "div.email-pic.designed" }];
  },
  renderHTML({ HTMLAttributes }) {
    return pictureHTML("email-pic designed", HTMLAttributes) as unknown as [string, Record<string, string>];
  },
});

export const EmailButton = Node.create({
  name: "emailButton",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { label: { default: "" }, href: { default: "https://africanfreefirecommunity.com/" }, align: { default: "center" } };
  },
  parseHTML() {
    return [{ tag: "div.email-btn" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ class: "email-btn", style: `text-align:${HTMLAttributes.align ?? "center"}` }),
      ["span", { class: "eb" }, String(HTMLAttributes.label ?? "")],
    ];
  },
});

const MAX_INDENT = 6;

export const EmailBlockAttrs = Extension.create({
  name: "emailBlockAttrs",
  addGlobalAttributes() {
    return [
      {
        types: ["orderedList", "bulletList"],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.listStyleType || null,
            renderHTML: (attrs) => (attrs.listStyle ? { style: `list-style-type:${attrs.listStyle}` } : {}),
          },
        },
      },
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.round((parseInt((el as HTMLElement).style.paddingLeft || "0", 10) || 0) / 28),
            renderHTML: (attrs) => (attrs.indent ? { style: `padding-left:${attrs.indent * 28}px` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setListStyle:
        (style: string) =>
        ({ editor, commands }) =>
          commands.updateAttributes(editor.isActive("orderedList") ? "orderedList" : "bulletList", { listStyle: style }),
      // In a list, indenting nests the item; anywhere else it moves the paragraph or heading in.
      indentMore:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive("listItem")) return commands.sinkListItem("listItem");
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const now = (editor.getAttributes(type).indent as number) || 0;
          return commands.updateAttributes(type, { indent: Math.min(MAX_INDENT, now + 1) });
        },
      indentLess:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive("listItem")) return commands.liftListItem("listItem");
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const now = (editor.getAttributes(type).indent as number) || 0;
          return commands.updateAttributes(type, { indent: Math.max(0, now - 1) });
        },
    };
  },
});
