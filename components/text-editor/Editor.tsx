"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Menubar } from "./Menubar";
// AlignedImage/GalleryNode/NewsVideoNode are our custom media nodes. They MUST be registered with
// the SAME list in RenderDescription.tsx (the reader) or articles render blank for readers. See the
// header comment in extensions.ts.
import {
  CustomTextStyle,
  AlignedImage,
  GalleryNode,
  NewsVideoNode,
} from "./extensions";

export function RichTextEditor({ field }: { field: any }) {
  // i18n: "editor" ns (editor.wordCount ICU plural). Shared rich-text editor used by news and
  // other forms, some on the non-exempt organizer surface.
  const t = useTranslations("editor");
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 hover:opacity-75",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      CustomTextStyle,
      AlignedImage.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-md my-4",
        },
      }),
      GalleryNode,
      NewsVideoNode,
    ],

    editorProps: {
      attributes: {
        class:
          "min-h-[350px] focus:outline-none px-5 py-4 w-full text-sm text-foreground",
      },
    },

    onUpdate: ({ editor }) => {
      field.onChange(JSON.stringify(editor.getJSON()));
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },

    content: field.value ? JSON.parse(field.value) : "",

    immediatelyRender: false,
  });

  return (
    <div className="border w-full border-input rounded-md dark:bg-input/30 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-shadow">
      <Menubar editor={editor} />
      <EditorContent editor={editor} />
      <div className="px-5 py-2 border-t border-input flex justify-end">
        <span className="text-xs text-muted-foreground">
          {t("wordCount", { count: wordCount })}
        </span>
      </div>
    </div>
  );
}
