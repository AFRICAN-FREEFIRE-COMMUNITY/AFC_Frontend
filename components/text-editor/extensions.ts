/**
 * Custom TipTap nodes + marks for the AFC rich-text editor (news articles + organizer copy).
 *
 * WHY THIS FILE EXISTS
 * News overhaul (owner): ALL article media (images, galleries, video) lives INSIDE the editor
 * content (Tiptap JSON) as nodes that carry an already-uploaded media URL. There is no gallery DB
 * table and no video model field; the editor just embeds URLs the upload endpoints return. This
 * file defines the four things the editor and the reader both need:
 *   - CustomTextStyle : font-size + font-family marks (no TipTap Pro needed).
 *   - AlignedImage    : the stock Image node + an `align` attribute (left|center|right|full).
 *   - GalleryNode     : an atom "gallery" node holding an array of image URLs in a CSS grid.
 *   - NewsVideoNode   : an atom "newsVideo" node holding an uploaded file URL or an embed URL.
 *
 * CRITICAL WIRING GOTCHA (read before touching): every node here MUST be registered in BOTH
 * components/text-editor/Editor.tsx (useEditor `extensions`) AND
 * components/text-editor/RenderDescription.tsx (generateHTML `extensions`) with the SAME list.
 * The reader renders stored JSON through @tiptap/html generateHTML, which serializes each node via
 * its STATIC renderHTML below. A node registered only in the editor (or one that renders only via a
 * React NodeView with no static renderHTML) produces BLANK markup for readers. So the gallery and
 * video nodes deliberately render purely from a static renderHTML (no NodeView) and every attribute
 * round-trips through parseHTML/renderHTML.
 *
 * CONNECTS TO:
 *   - Menubar.tsx toolbar controls insert/align these nodes and upload the media files to the
 *     backend endpoints POST /auth/upload-news-image/ and POST /auth/upload-news-video/ (both
 *     return { status:"ok", url }); the returned url is stored in the node attrs below.
 *   - The stored Tiptap JSON is the News.content TextField (afc_auth/models.py). Old content with
 *     plain <img> still parses: AlignedImage keeps the node name "image", `align` just defaults to
 *     null, so pre-overhaul articles render exactly as before.
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customTextStyle: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
      setFontFamily: (family: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    // Media nodes inserted by the Menubar toolbar (see below). Options carry already-uploaded URLs.
    gallery: {
      setGallery: (options: { images: string[]; columns?: number }) => ReturnType;
    };
    newsVideo: {
      setNewsVideo: (options: { src: string; provider: string }) => ReturnType;
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

// ── AlignedImage ─────────────────────────────────────────────────────────────
// The stock @tiptap/extension-image node ("image") + a single `align` attribute so an author can
// float/stretch a picture. We render alignment as INLINE styles (not a CSS class) on purpose: the
// reader (RenderDescription) has no @tailwindcss/typography and we do not touch globals.css in this
// slice, so inline styles are the only thing guaranteed to survive generateHTML on the read side.
// Menubar sets this via editor.updateAttributes("image", { align }). `align: null` (old content)
// renders unchanged.
const IMAGE_ALIGN_STYLE: Record<string, string> = {
  left: "display:block;margin-left:0;margin-right:auto;",
  center: "display:block;margin-left:auto;margin-right:auto;",
  right: "display:block;margin-left:auto;margin-right:0;",
  full: "display:block;width:100%;height:auto;margin-left:0;margin-right:0;",
};

export const AlignedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-align") || null,
        renderHTML: (attributes) => {
          if (!attributes.align) return {};
          // mergeAttributes concatenates the `style` here with the base HTMLAttributes style, so
          // the alignment adds to (does not clobber) the "max-w-full rounded-md my-4" class set in
          // Editor.tsx / RenderDescription.tsx.
          return {
            "data-align": attributes.align,
            style: IMAGE_ALIGN_STYLE[attributes.align as string] || "",
          };
        },
      },
    };
  },
});

// ── GalleryNode ("gallery") ──────────────────────────────────────────────────
// An ATOM block node that holds an array of already-uploaded image URLs and a column count. It is
// a leaf (no editable content); the images live in attrs and render as a responsive CSS grid via
// the STATIC renderHTML, so both the editor and the reader (generateHTML) show the same grid.
// Inserted by the Menubar gallery button after each picked file is uploaded to
// /auth/upload-news-image/.
export const GalleryNode = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      // Array of absolute media URLs. Serialized to a data-attribute so an HTML round-trip
      // (parseHTML) can rebuild it; the JSON path (Node.fromJSON) reads the array directly.
      images: {
        default: [] as string[],
        parseHTML: (element) => {
          try {
            return JSON.parse(element.getAttribute("data-images") || "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-images": JSON.stringify(attributes.images || []),
        }),
      },
      columns: {
        default: 3,
        parseHTML: (element) => Number(element.getAttribute("data-columns")) || 3,
        renderHTML: (attributes) => ({
          "data-columns": String(attributes.columns || 3),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-gallery]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const images: string[] = Array.isArray(node.attrs.images) ? node.attrs.images : [];
    const columns = Number(node.attrs.columns) || 3;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-gallery": "",
        "data-columns": String(columns),
        style: `display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:0.5rem;margin:1rem 0;`,
      }),
      // One <img> per url. Atom node => no content hole (0); children are baked in from attrs.
      ...images.map((src) => [
        "img",
        {
          src,
          loading: "lazy",
          style:
            "width:100%;height:100%;object-fit:cover;border-radius:0.375rem;display:block;",
        },
      ]),
    ];
  },

  addCommands() {
    return {
      setGallery:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

// ── NewsVideoNode ("newsVideo") ──────────────────────────────────────────────
// An ATOM block node for a single video. `provider === "file"` means src is an uploaded file URL
// (POST /auth/upload-news-video/) and renders a native <video controls>. Any other provider means
// src is a safe embed URL from lib/videoEmbed.ts parseVideoEmbed() (YouTube/TikTok/X/Facebook/
// Instagram/Drive) and renders a responsive 16:9 <iframe>. Static renderHTML so the reader shows it.
export const NewsVideoNode = Node.create({
  name: "newsVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-src"),
        renderHTML: (attributes) => ({ "data-src": attributes.src }),
      },
      provider: {
        default: "file",
        parseHTML: (element) => element.getAttribute("data-provider") || "file",
        renderHTML: (attributes) => ({ "data-provider": attributes.provider }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-news-video]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = (node.attrs.src as string) || "";
    const provider = (node.attrs.provider as string) || "file";

    // Uploaded file -> native player. max-width:100% keeps it inside the article column on mobile.
    if (provider === "file") {
      return [
        "div",
        mergeAttributes(HTMLAttributes, {
          "data-news-video": "",
          "data-provider": "file",
          "data-src": src,
          style: "margin:1rem 0;",
        }),
        [
          "video",
          {
            src,
            controls: "true",
            style:
              "max-width:100%;width:100%;border-radius:0.375rem;display:block;background:#000;",
          },
        ],
      ];
    }

    // Embed link -> responsive frame SHAPED to the provider so a vertical clip (TikTok, Instagram
    // reel) or a tweet card does not letterbox inside the article. Mirrors the per-provider framing
    // the player-markets embeds already use. Wide players (YouTube, Facebook, Drive, unknown) stay
    // 16:9 full width; portrait players are width-capped + given a taller ratio; a tweet card is
    // width-capped + taller. Same safe official-embed src videoEmbed.ts builds (no widget script).
    let ratioPct = "56.25%"; // 16:9 default
    let maxWidth = "";
    if (provider === "tiktok") {
      ratioPct = "160%";
      maxWidth = "340px";
    } else if (provider === "instagram") {
      ratioPct = "125%";
      maxWidth = "400px";
    } else if (provider === "twitter") {
      ratioPct = "130%";
      maxWidth = "550px";
    }
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-news-video": "",
        "data-provider": provider,
        "data-src": src,
        style:
          `position:relative;width:100%;${maxWidth ? `max-width:${maxWidth};` : ""}` +
          `padding-bottom:${ratioPct};margin:1rem auto;`,
      }),
      [
        "iframe",
        {
          src,
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:0.375rem;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setNewsVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
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
