/**
 * Custom TipTap TextStyle extension that adds font-size and font-family
 * support without requiring any TipTap Pro extensions.
 */
import { TextStyle } from "@tiptap/extension-text-style";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customTextStyle: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
      setFontFamily: (family: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
  }
}

export const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attributes) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
      setFontFamily:
        (family: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily: family }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontFamily: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

export const FONT_FAMILIES: {
  label: string;
  value: string;
  css: string;
}[] = [
  { label: "Default", value: "default", css: "inherit" },
  {
    label: "Serif",
    value: "Georgia, 'Times New Roman', serif",
    css: "Georgia, 'Times New Roman', serif",
  },
  {
    label: "Monospace",
    value: "'Courier New', Courier, monospace",
    css: "'Courier New', Courier, monospace",
  },
  {
    label: "Sans-Serif",
    value: "Arial, Helvetica, sans-serif",
    css: "Arial, Helvetica, sans-serif",
  },
];

export const FONT_SIZES: { label: string; value: string }[] = [
  { label: "Small", value: "13px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "X-Large", value: "24px" },
  { label: "Huge", value: "32px" },
];
