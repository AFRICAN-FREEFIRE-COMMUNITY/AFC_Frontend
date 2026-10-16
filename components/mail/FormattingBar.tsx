"use client";

// components/mail/FormattingBar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Gmail's rounded formatting bar (the owner's reference picture, inbox #288, 2026-10-16): undo, redo,
// Normal text / Title / Heading / Subheading, font, size, bold, italic, underline, strikethrough,
// text colour, alignment, numbered and bulleted lists, indent less and more, quote, clear formatting
// (#287: "fonts ... headers, numberings types"). On a phone it scrolls sideways inside itself; its
// menus are Radix portals, so the scrolling bar never clips them.
//
// CONNECTS TO: components/mail/Composer.tsx (owns the editor), emailExtensions.ts (indent and list
// style commands), emailStyle.ts (fonts). What each button makes is kept by afc_mail/document.py.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EmailStyle } from "@/lib/mailApi";
import { familyOf, fontNames, fontStack } from "./emailStyle";
import { MailIcon, type MailIconName } from "./MailIcon";

const SIZES = [12, 15, 18, 24, 32];
const PEN = ["#4ade80", "#16a34a", "#eab308", "#ffffff", "#cdd6cf", "#f87171", "#0d1410"];
const PICTURES = ["emailImage", "designedPicture", "emailButton"];

const ib =
  "inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 text-foreground hover:bg-foreground/10 aria-pressed:bg-background aria-pressed:text-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40";
const sel = "h-9 max-w-32 shrink-0 cursor-pointer rounded-full bg-transparent px-2 text-sm hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring";

function readState(e: Editor) {
  const ts = e.getAttributes("textStyle");
  const level = e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p";
  return {
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    strike: e.isActive("strike"),
    ordered: e.isActive("orderedList"),
    bullet: e.isActive("bulletList"),
    quote: e.isActive("blockquote"),
    level,
    font: familyOf(ts.fontFamily as string) || "",
    size: String(ts.fontSize ?? "").replace("px", ""),
    colour: (ts.color as string) || "",
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
  };
}

export function FormattingBar({ editor, style }: { editor: Editor | null; style: EmailStyle }) {
  const t = useTranslations("emailNews");
  // The swatches are plain buttons (a row of circles, not menu rows), so picking one closes the
  // palette by hand, as Gmail's does.
  const [colourOpen, setColourOpen] = useState(false);
  // useEditorState keeps its first snapshot (taken while the editor was still null) until the first
  // transaction, so until the admin types or clicks the bar reads the editor directly.
  const snapshot = useEditorState({ editor, selector: ({ editor: e }) => (e ? readState(e) : null) });
  const state = snapshot ?? (editor ? readState(editor) : null);
  if (!editor || !state) return null;
  const chain = () => editor.chain().focus();

  const btn = (icon: MailIconName | null, label: string, onClick: () => void, pressed?: boolean, content?: React.ReactNode, disabled?: boolean) => (
    <button
      type="button"
      className={ib}
      aria-label={label}
      title={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon ? <MailIcon name={icon} /> : content}
    </button>
  );

  const align = (a: "left" | "center" | "right") => {
    // A picked picture or button takes the alignment itself; words take it on their paragraph.
    const node = PICTURES.find((n) => editor.isActive(n));
    if (node) editor.chain().updateAttributes(node, { align: a }).run();
    else chain().setTextAlign(a).run();
  };

  return (
    <div className="email-fmt flex items-center gap-0.5 overflow-x-auto rounded-xl bg-muted px-2 py-1 md:flex-wrap md:overflow-visible md:rounded-full" role="toolbar" aria-label={t("fmt.toolbar")}>
      {btn("undo", t("fmt.undo"), () => chain().undo().run(), undefined, undefined, !state.canUndo)}
      {btn("redo", t("fmt.redo"), () => chain().redo().run(), undefined, undefined, !state.canRedo)}
      <span className="w-1.5 shrink-0" />
      <select
        className={sel}
        aria-label={t("fmt.textStyle")}
        value={state.level}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">{t("fmt.normal")}</option>
        <option value="h1">{t("fmt.title")}</option>
        <option value="h2">{t("fmt.heading")}</option>
        <option value="h3">{t("fmt.subheading")}</option>
      </select>
      <select
        className={sel}
        aria-label={t("fmt.font")}
        value={state.font || style.bodyFont}
        onChange={(e) => chain().setFontFamily(fontStack(e.target.value, style)).run()}
      >
        {fontNames(style).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className={`${sel} max-w-20`}
        aria-label={t("fmt.size")}
        value={SIZES.includes(Number(state.size)) ? state.size : ""}
        onChange={(e) => (e.target.value ? chain().setFontSize(`${e.target.value}px`).run() : chain().unsetFontSize().run())}
      >
        <option value="">{t("fmt.sizeDefault")}</option>
        {SIZES.map((s) => (
          <option key={s} value={String(s)}>
            {s}
          </option>
        ))}
      </select>
      <span className="w-1.5 shrink-0" />
      {btn(null, t("fmt.bold"), () => chain().toggleBold().run(), state.bold, <b className="text-base">B</b>)}
      {btn(null, t("fmt.italic"), () => chain().toggleItalic().run(), state.italic, <i className="font-serif text-base">I</i>)}
      {btn(null, t("fmt.underline"), () => chain().toggleUnderline().run(), state.underline, <u className="text-base">U</u>)}
      {btn("strike", t("fmt.strike"), () => chain().toggleStrike().run(), state.strike)}
      <DropdownMenu modal={false} open={colourOpen} onOpenChange={setColourOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ib} aria-label={t("fmt.colour")} title={t("fmt.colour")} onMouseDown={(e) => e.preventDefault()}>
            <span className="grid justify-items-center text-base leading-none font-bold">
              A<span className="mt-0.5 block h-1 w-4 rounded-sm" style={{ background: state.colour || style.text }} />
            </span>
            <MailIcon name="dropDown" className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("fmt.colour")}</DropdownMenuLabel>
          <div className="flex gap-1 px-2 pb-2">
            {PEN.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={t("fmt.colourValue", { colour: c })}
                className="size-7 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                style={{ background: c }}
                onClick={() => {
                  chain().setColor(c).run();
                  setColourOpen(false);
                }}
              />
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
            <input
              type="color"
              defaultValue={state.colour || "#4ade80"}
              onChange={(e) => editor.chain().setColor(e.target.value).run()}
              className="size-7 cursor-pointer rounded-md bg-transparent p-0"
            />
            {t("fmt.anyColour")}
          </label>
          {/* Normal case, like the "Any other colour" row above it (the house menu row is uppercase). */}
          <DropdownMenuItem className="text-sm font-normal normal-case" onSelect={() => chain().unsetColor().run()}>
            {t("fmt.ownColour")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="w-1.5 shrink-0" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ib} aria-label={t("fmt.align")} title={t("fmt.align")} onMouseDown={(e) => e.preventDefault()}>
            <MailIcon name="alignLeft" />
            <MailIcon name="dropDown" className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => align("left")}>
            <MailIcon name="alignLeft" className="size-4" /> {t("fmt.left")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => align("center")}>
            <MailIcon name="alignCenter" className="size-4" /> {t("fmt.centre")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => align("right")}>
            <MailIcon name="alignRight" className="size-4" /> {t("fmt.right")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {btn("listNumbered", t("fmt.numbered"), () => chain().toggleOrderedList().run(), state.ordered)}
      {btn("listBulleted", t("fmt.bulleted"), () => chain().toggleBulletList().run(), state.bullet)}
      {btn("indentLess", t("fmt.indentLess"), () => chain().indentLess().run())}
      {btn("indentMore", t("fmt.indentMore"), () => chain().indentMore().run())}
      {btn("quote", t("fmt.quote"), () => chain().toggleBlockquote().run(), state.quote)}
      {btn("clear", t("fmt.clear"), () => chain().unsetAllMarks().clearNodes().run())}
    </div>
  );
}
