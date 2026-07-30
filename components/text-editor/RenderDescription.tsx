"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { generateHTML } from "@tiptap/html";
import { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
// AlignedImage/GalleryNode/NewsVideoNode: the reader side of the news media nodes. This list MUST
// stay identical to Editor.tsx's useEditor extensions, otherwise generateHTML emits blank markup for
// any node it does not know about (the news-media wiring gotcha, see extensions.ts header).
import {
  CustomTextStyle,
  AlignedImage,
  GalleryNode,
  NewsVideoNode,
} from "./extensions";
import parse from "html-react-parser";

export const RenderDescription = ({
  json,
  truncate = false,
  className = "",
}: {
  json?: string | JSONContent | any;
  truncate?: boolean;
  className?: string;
}) => {
  // i18n: "editor" ns. Only the parse-failure fallback below is user-facing here; the rendered
  // rich text itself is stored content, not a UI string.
  const t = useTranslations("editor");
  const output = useMemo(() => {
    if (!json) {
      return "<p></p>";
    }

    try {
      let parsedJson: any;

      if (typeof json === "string") {
        parsedJson = JSON.parse(json);
      } else {
        parsedJson = json;
      }

      if (!parsedJson || typeof parsedJson !== "object" || !parsedJson.type) {
        return "<p></p>";
      }

      const html = generateHTML(parsedJson, [
        StarterKit,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Underline,
        Link.configure({ openOnClick: false }),
        CustomTextStyle,
        // Same config object as Editor.tsx so image classes match between author + reader.
        AlignedImage.configure({
          HTMLAttributes: {
            class: "max-w-full rounded-md my-4",
          },
        }),
        GalleryNode,
        NewsVideoNode,
      ]);

      // generateHTML() uses ProseMirror's DOMSerializer, which stamps
      // xmlns="http://www.w3.org/1999/xhtml" onto every serialized block element. React reads that
      // attribute as a namespace switch and hydrates the subtree in XML/foreign mode; hydrating an
      // interactive HTML element inside it (specifically the NewsVideoNode <iframe>) then mismatches
      // the server markup, so React regenerates the tree and the video iframe is DROPPED on the
      // client - intermittently, since it is a hydration race (the <img> in AlignedImage/GalleryNode
      // survives because a void element has no such mode conflict). Stripping the redundant xhtml
      // namespace decl makes the markup plain HTML that hydrates identically on server + client, so
      // the news article video renders reliably. See app/(user)/news/[slug] (NewsClient) which is the
      // SSR-then-hydrate consumer that exposed this; the admin editor never SSRs so it was unaffected.
      return html.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
    } catch (error) {
      return `<p>${t("contentError")}</p>`;
    }
  }, [json, t]);

  // rich-content provides all base typography; prose classes dropped
  // since @tailwindcss/typography is not installed in this project.
  const baseClasses = "rich-content max-w-none";
  const truncateClasses = truncate
    ? "line-clamp-2 overflow-hidden [&>*]:m-0 [&>p]:leading-tight [&>*]:break-words [&>*]:max-w-full"
    : "";

  return (
    <div className={`${baseClasses} ${truncateClasses} ${className}`}>
      {parse(output)}
    </div>
  );
};

// utils/extractTiptapText.ts
export const extractTiptapText = (jsonString: string | any): string => {
  if (!jsonString) return "";

  try {
    // Parse the JSON string
    let jsonContent;
    if (typeof jsonString === "string") {
      jsonContent = JSON.parse(jsonString);
    } else {
      jsonContent = jsonString;
    }

    // Recursive function to extract text from Tiptap JSON
    const extractTextFromNode = (node: any): string => {
      if (!node) return "";

      // If it's a text node, return the text
      if (node.type === "text") {
        return node.text || "";
      }

      // If it has content (array of child nodes), process each child
      if (node.content && Array.isArray(node.content)) {
        return node.content
          .map((child: any) => extractTextFromNode(child))
          .join(" ");
      }

      return "";
    };

    const fullText = extractTextFromNode(jsonContent);

    // Clean up extra whitespace
    return fullText.replace(/\s+/g, " ").trim();
  } catch (error) {
    return "";
  }
};

// Truncate text to specified length
export const truncateText = (text: string, maxLength: number = 150): string => {
  if (!text || text.length <= maxLength) return text;

  // Find the last space before the max length to avoid cutting words
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
};
