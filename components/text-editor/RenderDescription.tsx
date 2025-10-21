"use client";

import { useMemo } from "react";
import { generateHTML } from "@tiptap/html";
import { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import parse from "html-react-parser";

// export const RenderDescription = ({
//   json,
//   className = "",
// }: {
//   json?: string | JSONContent | any;
//   className?: string;
// }) => {
//   const output = useMemo(() => {
//     if (!json) {
//       return "<p></p>";
//     }

//     try {
//       // If json is a string, parse it first
//       let parsedJson: JSONContent;

//       if (typeof json === "string") {
//         parsedJson = JSON.parse(json);
//       } else {
//         parsedJson = json;
//       }

//       // Validate the parsed JSON structure
//       if (!parsedJson || typeof parsedJson !== "object" || !parsedJson.type) {
//         return "<p></p>";
//       }

//       return generateHTML(parsedJson, [
//         StarterKit,
//         TextAlign.configure({ types: ["heading", "paragraph"] }),
//       ]);
//     } catch (error) {
//       console.error("Error parsing or generating HTML:", error);
//       console.error("Original json:", json);
//       return "<p>Content could not be rendered</p>";
//     }
//   }, [json]);

//   return (
//     <div
//       className={`prose dark:prose-invert prose-li:marker:text-primary h-full`}
//     >
//       {parse(output)}
//     </div>
//   );
// };

export const RenderDescription = ({
  json,
  truncate = false,
  className = "",
}: {
  json?: string | JSONContent | any;
  truncate?: boolean;
  className?: string;
}) => {
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

      return generateHTML(parsedJson, [
        StarterKit,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
      ]);
    } catch (error) {
      console.error("Error parsing or generating HTML:", error);
      return "<p>Content could not be rendered</p>";
    }
  }, [json]);

  const baseClasses = "prose dark:prose-invert prose-li:marker:text-primary";
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
    console.error("Error extracting text from Tiptap JSON:", error);
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
