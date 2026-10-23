"use client";

// components/mail/PickedBar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The bar that opens just above the formatting bar for whatever is picked in the email, the way Word
// and Google Docs show picture options (inbox #288): a picture (size, position, transparency,
// description, link, replace, remove: #284), a designed picture (edit it again), a button (words,
// link, position), a link, a list (numbering 1 a A i I and the start number, or dot circle square:
// #287), or, from the palette, the colours and fonts of the whole email (DesignPanel).
//
// Editing a picked picture changes its node's attributes; the server keeps them through the allowlist
// (afc_mail/document.py) and bakes transparency into the picture it sends (afc_mail/assets.py).
// CONNECTS TO: components/mail/Composer.tsx (decides what is picked), lib/mailApi.ts (replace picture).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { errorCode, mailAdmin, type EmailStyle } from "@/lib/mailApi";
import { DesignPanel } from "./DesignPanel";

export type PickedMode = "design" | "newlink" | null;

const NUMBERING = ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"] as const;
const BULLETS = ["disc", "circle", "square"] as const;

function readPicked(e: Editor) {
  for (const kind of ["emailImage", "designedPicture", "emailButton"] as const) {
    if (e.isActive(kind)) return { kind, attrs: { ...e.getAttributes(kind) } };
  }
  if (e.isActive("link")) return { kind: "link" as const, attrs: { ...e.getAttributes("link") } };
  if (e.isActive("orderedList")) return { kind: "orderedList" as const, attrs: { ...e.getAttributes("orderedList") } };
  if (e.isActive("bulletList")) return { kind: "bulletList" as const, attrs: { ...e.getAttributes("bulletList") } };
  return null;
}

export function PickedBar({
  editor,
  mode,
  setMode,
  style,
  onStyle,
  onEditDesigned,
}: {
  editor: Editor | null;
  /** "design" (palette) and "newlink" (link button) are opened on purpose; the rest follow the selection. */
  mode: PickedMode;
  setMode: (m: PickedMode) => void;
  style: EmailStyle;
  onStyle: (s: EmailStyle) => void;
  onEditDesigned: () => void;
}) {
  const t = useTranslations("emailNews");
  // The snapshot is null until the first transaction (see FormattingBar), so read the editor until then.
  const snapshot = useEditorState({ editor, selector: ({ editor: e }) => (e ? readPicked(e) : null) });
  const picked = snapshot ?? (editor ? readPicked(editor) : null);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkWords, setLinkWords] = useState("");
  const kind = mode ?? picked?.kind ?? null;
  const attrs = (picked?.attrs ?? {}) as Record<string, unknown>;

  // A new pick (or a new mode) starts the error and the link fields over; typing in them must not.
  // Adjusted while rendering (React's pattern for state that follows a changing input), not in an effect.
  const pickKey = `${kind ?? ""}|${String(attrs.href ?? "")}`;
  const [seenKey, setSeenKey] = useState(pickKey);
  if (seenKey !== pickKey) {
    setSeenKey(pickKey);
    setError(null);
    setLinkUrl(kind === "link" ? String(attrs.href ?? "") : "");
    setLinkWords("");
  }

  // The bar sits at the bottom of the screen with the formatting bar, so on a short screen it can open
  // over the very picture or button it is about. Once it has opened, scroll the page just enough that
  // the picked thing sits above it, as Google Docs does (walk of 16 Oct 2026, a 744 px tall window).
  const regionRef = useRef<HTMLDivElement>(null);
  const pickedFrom = editor?.state.selection.from ?? -1;
  useEffect(() => {
    if (!editor || !regionRef.current || !(kind === "emailImage" || kind === "designedPicture" || kind === "emailButton")) return;
    const node = editor.view.dom.querySelector(".ProseMirror-selectednode");
    if (!node) return;
    const fit = () => {
      if (!regionRef.current) return;
      const overlap = node.getBoundingClientRect().bottom - regionRef.current.getBoundingClientRect().top + 12;
      if (overlap > 0) window.scrollBy({ top: overlap });
    };
    fit();
    // A picture just inserted has no height until it loads; check again once it has one.
    const img = node.querySelector("img");
    if (img && !img.complete) {
      img.addEventListener("load", fit, { once: true });
      return () => img.removeEventListener("load", fit);
    }
  }, [editor, kind, pickedFrom]);

  if (!editor || !kind) return null;

  const set = (patch: Record<string, unknown>) => {
    const node = picked?.kind;
    if (node) editor.chain().updateAttributes(node, patch).run();
  };
  const close = () => {
    setMode(null);
    // Leave the pick and put the caret after it, so typing carries on below. After a picked picture
    // or button, "after it" is the start of the next paragraph (the editor always keeps one at the
    // end); the position right after the node itself holds no text, and ProseMirror warns on it.
    const { doc, selection } = editor.state;
    let caret = selection.to;
    if ("node" in selection) {
      let next: number | null = null;
      doc.nodesBetween(selection.to, doc.content.size, (node, pos) => {
        if (next !== null) return false;
        if (node.isTextblock && pos >= selection.to) {
          next = pos + 1;
          return false;
        }
        return true;
      });
      if (next !== null) caret = next;
    }
    editor.chain().focus().setTextSelection(caret).run();
  };

  const head = (title: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <b className="text-sm">{title}</b>
      <div className="flex flex-wrap gap-2">
        {extra}
        <Button type="button" size="sm" variant="secondary" onClick={close}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
  const range = (label: string, min: number, max: number, value: number, fmt: (v: number) => string, onValue: (v: number) => void) => (
    <label className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)_auto]">
      <span className="col-span-2 sm:col-span-1">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onValue(Number(e.target.value))} className="w-full accent-primary" />
      <output className="text-muted-foreground">{fmt(value)}</output>
    </label>
  );
  const seg = (label: string, options: [string, string][], value: string, onPick: (v: string) => void) => (
    <div className="grid grid-cols-1 items-center gap-1 text-sm sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
      <span>{label}</span>
      <div className="inline-flex w-fit gap-1 rounded-md bg-muted p-1" role="group" aria-label={label}>
        {options.map(([k, txt]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onPick(k)}
            className={`rounded-sm px-3 py-1 text-sm ${value === k ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
  const field = (label: string, value: string, onValue: (v: string) => void, placeholder?: string) => (
    <label className="grid gap-1 text-xs font-medium">
      {label}
      <input
        className="h-9 rounded-md bg-muted px-3 text-sm font-normal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValue(e.target.value)}
      />
    </label>
  );
  const positions: [string, string][] = [["left", t("fmt.left")], ["center", t("fmt.centre")], ["right", t("fmt.right")]];

  let body: React.ReactNode = null;
  if (kind === "emailImage" || kind === "designedPicture") {
    const designed = kind === "designedPicture";
    body = (
      <>
        {head(designed ? t("picked.designed") : t("picked.picture"), designed && (
          <Button type="button" size="sm" onClick={onEditDesigned}>
            {t("picked.editDesign")}
          </Button>
        ))}
        {range(t("picked.size"), 10, 100, Number(attrs.width ?? 100), (v) => t("percent", { n: v }), (v) => set({ width: v }))}
        {seg(t("picked.position"), positions, String(attrs.align ?? "center"), (v) => set({ align: v }))}
        {range(t("picked.transparency"), 0, 90, Math.round((1 - Number(attrs.opacity ?? 1)) * 100), (v) => t("percent", { n: v }), (v) => set({ opacity: Math.round(100 - v) / 100 }))}
        {!designed && (
          <div className="grid gap-2 sm:grid-cols-2">
            {field(t("picked.description"), String(attrs.alt ?? ""), (v) => set({ alt: v }))}
            {field(t("picked.link"), String(attrs.href ?? ""), (v) => set({ href: v || null }), "https://africanfreefirecommunity.com/...")}
          </div>
        )}
        {designed && <p className="text-xs text-muted-foreground">{t("picked.designedNote")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {!designed && (
            <label className="relative inline-flex h-8 cursor-pointer items-center overflow-hidden rounded-md bg-muted px-3 text-sm font-medium hover:bg-muted/70">
              {t("picked.replace")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setError(null);
                  try {
                    const asset = await mailAdmin.upload("image", f, f.name);
                    set({ asset: asset.token, src: asset.url });
                  } catch (err) {
                    const code = errorCode(err);
                    setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                  }
                }}
              />
            </label>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => editor.chain().focus().deleteSelection().run()}>
            {t("remove")}
          </Button>
          {!designed && <span className="text-xs text-muted-foreground">{t("picked.bakedNote")}</span>}
        </div>
      </>
    );
  } else if (kind === "emailButton") {
    body = (
      <>
        {head(t("picked.button"))}
        <div className="grid gap-2 sm:grid-cols-2">
          {field(t("picked.buttonWords"), String(attrs.label ?? ""), (v) => set({ label: v }))}
          {field(t("picked.opens"), String(attrs.href ?? ""), (v) => set({ href: v }), "https://africanfreefirecommunity.com/...")}
        </div>
        {seg(t("picked.position"), positions, String(attrs.align ?? "center"), (v) => set({ align: v }))}
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={() => editor.chain().focus().deleteSelection().run()}>
            {t("picked.removeButton")}
          </Button>
        </div>
      </>
    );
  } else if (kind === "link" || kind === "newlink") {
    const isNew = kind === "newlink";
    const hasText = !editor.state.selection.empty;
    const save = () => {
      const url = linkUrl.trim();
      if (!/^(https?:\/\/|mailto:)\S+$/i.test(url)) {
        setError(t("picked.linkInvalid"));
        return;
      }
      if (!isNew) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      else if (hasText) editor.chain().focus().setLink({ href: url }).run();
      else editor.chain().focus().insertContent([{ type: "text", text: linkWords.trim() || url, marks: [{ type: "link", attrs: { href: url } }] }, { type: "text", text: " " }]).run();
      setMode(null);
    };
    body = (
      <>
        {head(t("picked.link"))}
        <div className="grid gap-2 sm:grid-cols-2">
          {field(t("picked.linkAddress"), linkUrl, setLinkUrl, "https://africanfreefirecommunity.com/...")}
          {isNew && !hasText && field(t("picked.linkWords"), linkWords, setLinkWords)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={save}>
            {isNew ? t("picked.addLink") : t("picked.saveLink")}
          </Button>
          {!isNew && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setMode(null);
              }}
            >
              {t("picked.removeLink")}
            </Button>
          )}
        </div>
      </>
    );
  } else if (kind === "orderedList") {
    body = (
      <>
        {head(t("picked.numbered"))}
        <label className="grid grid-cols-1 items-center gap-1 text-sm sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
          <span>{t("picked.numbering")}</span>
          <select
            className="h-9 w-fit rounded-md bg-muted px-2 text-sm"
            value={String(attrs.listStyle ?? "decimal")}
            onChange={(e) => editor.chain().setListStyle(e.target.value).run()}
          >
            {NUMBERING.map((n) => (
              <option key={n} value={n}>
                {t(`picked.numberingStyle.${n}`)}
              </option>
            ))}
          </select>
        </label>
        {range(t("picked.startAt"), 1, 20, Number(attrs.start ?? 1), (v) => String(v), (v) => editor.chain().updateAttributes("orderedList", { start: v }).run())}
      </>
    );
  } else if (kind === "bulletList") {
    body = (
      <>
        {head(t("picked.bulleted"))}
        {seg(
          t("picked.bullet"),
          BULLETS.map((b) => [b, t(`picked.bulletStyle.${b}`)] as [string, string]),
          String(attrs.listStyle ?? "disc"),
          (v) => editor.chain().setListStyle(v).run(),
        )}
      </>
    );
  } else if (kind === "design") {
    body = (
      <>
        {head(t("design.title"))}
        <DesignPanel style={style} onChange={onStyle} />
      </>
    );
  }

  return (
    <div ref={regionRef} className="grid max-h-[38vh] gap-3 overflow-y-auto rounded-xl bg-background p-3 md:max-h-[46vh]" role="region" aria-label={t("picked.region")}>
      {body}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
