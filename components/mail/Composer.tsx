"use client";

// components/mail/Composer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Write and send email news, in ONE window like Gmail's (owner 2026-10-16, inbox #288: "cannot it not
// llok like noirmal word document editing? or how it looks inside gmail or outlook", with pictures of
// Gmail's formatting bar and Send row; mockup approved the same day, built under #290).
//
// TOP: Start from (templates and past emails), Computer / Phone; the To line (ToLine); Language, each
// language its own copy; Subject; Preview line. MIDDLE: the email itself, typed into in place (Tiptap,
// drawn in the campaign's style), or the uploaded design (OwnDesign). BOTTOM, kept on screen: the bar
// for what is picked (PickedBar), the formatting bar (FormattingBar), the Send row.
//
// SAVING: every change is saved to the draft a moment after it is made (PATCH mail/campaigns/<token>/);
// sending, testing, previewing and templates save first. The server is the authority on what an email
// may hold (afc_mail/document.py, style.py) and answers with what it kept.
//
// CONNECTS TO: app/(a)/a/email-news/[token]/page.tsx (loads the draft), lib/mailApi.ts (every call),
// components/mail/* (the parts), composer.css (the email page).
// ─────────────────────────────────────────────────────────────────────────────
import "./composer.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/i18n/number";
import {
  errorCode,
  LANGS,
  mailAdmin,
  type Asset,
  type AudienceSpec,
  type Campaign,
  type CampaignInput,
  type CampaignRow,
  type EmailDoc,
  type EmailStyle,
  type Lang,
  type Template,
} from "@/lib/mailApi";
import { DesignedPictureDialog, type BoardDesign, type DesignedResult } from "./DesignedPictureDialog";
import { DesignedPicture, EmailBlockAttrs, EmailButton, EmailImage } from "./emailExtensions";
import { DEFAULT_STYLE, EMAIL_FOOTER, styleVars } from "./emailStyle";
import { FormattingBar } from "./FormattingBar";
import { MailIcon } from "./MailIcon";
import { OwnDesign } from "./OwnDesign";
import { PickedBar, type PickedMode } from "./PickedBar";
import { ToLine } from "./ToLine";
import { aliasSiteDmSans, useEmailFonts } from "./useEmailFonts";

type Fields = Record<`subject_${Lang}` | `preheader_${Lang}`, string>;
const FIELD_KEYS = LANGS.flatMap((l) => [`subject_${l}`, `preheader_${l}`]) as (keyof Fields)[];

const fieldsOf = (c: Campaign): Fields => Object.fromEntries(FIELD_KEYS.map((k) => [k, (c[k] as string) ?? ""])) as Fields;
const specOf = (a: Campaign["audience"]): AudienceSpec => ({
  everyone: !!a?.everyone,
  user_ids: (a?.user_ids as number[]) ?? [],
  team_ids: (a?.team_ids as number[]) ?? [],
  tiers: (a?.tiers as string[]) ?? [],
  countries: (a?.countries as string[]) ?? [],
  roles: (a?.roles as string[]) ?? [],
  languages: (a?.languages as string[]) ?? [],
});

/** Documents hold asset tokens; the editor also needs each picture's address to show it. */
function withSrc(doc: EmailDoc | null | undefined, assets: Record<string, Asset>): EmailDoc | null {
  if (!doc) return null;
  const walk = (nodes: unknown[] | undefined): unknown[] | undefined =>
    nodes?.map((n) => {
      const node = n as { type: string; attrs?: Record<string, unknown>; content?: unknown[] };
      const out = { ...node };
      if ((node.type === "emailImage" || node.type === "designedPicture") && node.attrs) {
        out.attrs = { ...node.attrs, src: assets[node.attrs.asset as string]?.url ?? null };
      }
      if (node.content) out.content = walk(node.content);
      return out;
    });
  return { type: "doc", content: (walk(doc.content) ?? []) as EmailDoc["content"] };
}

function docIsEmpty(doc: EmailDoc | null | undefined): boolean {
  const walk = (nodes: unknown[] | undefined): boolean =>
    (nodes ?? []).every((n) => {
      const node = n as { type: string; text?: string; content?: unknown[] };
      if (["emailImage", "designedPicture", "emailButton"].includes(node.type)) return false;
      if (node.type === "text" && node.text?.trim()) return false;
      return walk(node.content);
    });
  return !doc || walk(doc.content);
}

export function Composer({ initial, onSent }: { initial: Campaign; /** the page reloads the campaign, which is no longer a draft, so it shows the tracker */ onSent: () => void }) {
  const t = useTranslations("emailNews");
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [lang, setLang] = useState<Lang>("en");
  const [docs, setDocs] = useState<Partial<Record<Lang, EmailDoc | null>>>(() =>
    Object.fromEntries(LANGS.map((l) => [l, withSrc(initial.docs[l], initial.assets)])),
  );
  const [fields, setFields] = useState<Fields>(() => fieldsOf(initial));
  const [style, setStyle] = useState<EmailStyle>(initial.style ?? DEFAULT_STYLE);
  const [mode, setMode] = useState(initial.mode);
  const [audience, setAudience] = useState<AudienceSpec>(() => specOf(initial.audience));
  const [count, setCount] = useState<number | null>(null);
  const [view, setView] = useState<"desk" | "phone">("desk");
  const [fmtOpen, setFmtOpen] = useState(true);
  const [picked, setPicked] = useState<PickedMode>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [rev, setRev] = useState(0);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmStart, setConfirmStart] = useState<null | { template: string } | { campaign: string } | { blank: true }>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [preview, setPreview] = useState<{ html: string; size_kb: number } | null>(null);
  const [designer, setDesigner] = useState<{ open: boolean; initial: BoardDesign | null; editing: boolean }>({ open: false, initial: null, editing: false });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pastEmails, setPastEmails] = useState<CampaignRow[]>([]);
  const [busy, setBusy] = useState(false);
  const dirty = useRef<Set<string>>(new Set());
  const langRef = useRef<Lang>("en");
  const editorRef = useRef<Editor | null>(null);
  const token = campaign.token;

  useEmailFonts(style);
  useEffect(() => aliasSiteDmSans(), []);

  // "Saving..." is set here, where the change happens, never in the effect below: a state update in
  // an effect on every keystroke counts as a nested update, and after ~50 fast keystrokes React stops
  // with "Maximum update depth exceeded" and drops one (seen in the local walk, 2026-10-16).
  const touch = useCallback((what: string) => {
    dirty.current.add(what);
    setRev((r) => r + 1);
    setSaveState("saving");
  }, []);

  // The editor's options are built ONCE. Tiptap compares them on every render and, when any differs
  // (a new extension instance, a new editorProps object, new starting content), pushes them into the
  // live editor again (setOptions + updateState). Built inline they were new on every render, and
  // typing (which renders) looped: "Maximum update depth exceeded" and a lost keystroke in the walk.
  const editorOptions = useMemo(
    () => ({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          code: false,
          horizontalRule: false,
          heading: { levels: [1, 2, 3] as (1 | 2 | 3)[] },
          link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: null } },
        }),
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        EmailImage,
        DesignedPicture,
        EmailButton,
        EmailBlockAttrs,
      ],
      content: initial.docs.en ? (withSrc(initial.docs.en, initial.assets) ?? "") : "",
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "focus:outline-none", "aria-label": t("emailBody"), role: "textbox", "aria-multiline": "true" },
        // Pasted words come in as words: nothing pasted may pull pictures or styles from another site.
        handlePaste: (_view: unknown, event: ClipboardEvent) => {
          const text = event.clipboardData?.getData("text/plain");
          if (text == null || !editorRef.current) return false;
          const paras = text.split(/\n\s*\n/).map((p) => ({
            type: "paragraph",
            content: p.trim() ? [{ type: "text", text: p.replace(/\s*\n\s*/g, " ").trim() }] : [],
          }));
          editorRef.current.commands.insertContent(paras.length === 1 ? paras[0].content : paras);
          return true;
        },
      },
    }),
    // Once per draft: the starting content is read when the composer opens, later changes go through
    // setContent (language switch, start from), never through the options.
    [initial, t],
  );
  const editor = useEditor({
    ...editorOptions,
    onUpdate: ({ editor: e }) => {
      const l = langRef.current;
      setDocs((d) => ({ ...d, [l]: e.getJSON() as EmailDoc }));
      touch(`doc:${l}`);
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  // The snapshot is null until the first transaction (see FormattingBar), so read the editor until then.
  const emptySnapshot = useEditorState({ editor, selector: ({ editor: e }) => (e ? e.isEmpty : null) });
  const isEmpty = emptySnapshot ?? editor?.isEmpty ?? true;

  // ── saving ──────────────────────────────────────────────────────────────────────────────────
  const latest = useRef({ docs, fields, style, mode, audience });
  useEffect(() => {
    latest.current = { docs, fields, style, mode, audience };
  }, [docs, fields, style, mode, audience]);

  const saveNow = useCallback(async () => {
    const keys = Array.from(dirty.current);
    if (!keys.length) return;
    dirty.current.clear();
    const now = latest.current;
    const input: CampaignInput = {};
    const docsOut: Partial<Record<Lang, EmailDoc | null>> = {};
    for (const k of keys) {
      if (k.startsWith("doc:")) {
        const l = k.slice(4) as Lang;
        docsOut[l] = now.docs[l] ?? null;
      } else if (k === "fields") Object.assign(input, now.fields);
      else if (k === "style") input.style = now.style;
      else if (k === "mode") input.mode = now.mode;
      else if (k === "audience") input.audience = now.audience;
    }
    if (Object.keys(docsOut).length) input.docs = docsOut;
    setSaveState("saving");
    try {
      const saved = await mailAdmin.save(token, input);
      setCampaign(saved);
      setSaveState("saved");
    } catch (err) {
      keys.forEach((k) => dirty.current.add(k));
      setSaveState("error");
      throw err;
    }
  }, [token]);
  // Saves run one after another, never side by side: a slow save still in flight could otherwise
  // land after a newer one and put older words back. Waiting on the chain also means "Save draft",
  // "Send me a test" and Send see every save that was already on its way, not only their own.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const flush = useCallback(() => {
    const next = saving.current.catch(() => undefined).then(saveNow);
    saving.current = next;
    return next;
  }, [saveNow]);

  useEffect(() => {
    if (rev === 0) return;
    const timer = setTimeout(() => {
      flush().catch(() => undefined); // the header says "Not saved" and offers to try again
    }, 1200);
    return () => clearTimeout(timer);
  }, [rev, flush]);

  const run = async (what: () => Promise<void>) => {
    setBusy(true);
    try {
      await flush();
      await what();
    } catch (err) {
      const code = errorCode(err);
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setBusy(false);
    }
  };

  // ── language copies ───────────────────────────────────────────────────────────────────────────
  const switchLang = (l: Lang) => {
    setLang(l);
    langRef.current = l;
    setPicked(null);
    editor?.commands.setContent(docs[l] ?? "", { emitUpdate: false });
  };
  const copyEnglish = () => {
    const en = docs.en ?? null;
    setDocs((d) => ({ ...d, [lang]: en }));
    editor?.commands.setContent(en ?? "", { emitUpdate: false });
    touch(`doc:${lang}`);
  };

  // A whole new state from the server (start from a template, a past email, blank).
  const load = (c: Campaign) => {
    setCampaign(c);
    const nextDocs = Object.fromEntries(LANGS.map((l) => [l, withSrc(c.docs[l], c.assets)]));
    setDocs(nextDocs);
    setFields(fieldsOf(c));
    setStyle(c.style ?? DEFAULT_STYLE);
    setMode(c.mode);
    editor?.commands.setContent(nextDocs[langRef.current] ?? "", { emitUpdate: false });
  };

  // Templates and sent emails for "Start from", once.
  useEffect(() => {
    mailAdmin.templates().then((p) => setTemplates(p.results)).catch(() => setTemplates([]));
    mailAdmin
      .list(0, 50)
      .then((p) => setPastEmails(p.results.filter((r) => r.status === "sent" && r.token !== token)))
      .catch(() => setPastEmails([]));
  }, [token]);

  const startFrom = (value: string) => {
    if (!value) return;
    const [kind, id] = value.split(":");
    const from = kind === "t" ? { template: id } : kind === "c" ? { campaign: id } : { blank: true as const };
    const written = LANGS.some((l) => !docIsEmpty(docs[l])) || Object.values(fields).some(Boolean);
    if (written) setConfirmStart(from);
    else void run(async () => load(await mailAdmin.startFrom(token, from)));
  };

  // ── inserting things ─────────────────────────────────────────────────────────────────────────
  const insertPicture = (file: File) =>
    run(async () => {
      const asset = await mailAdmin.upload("image", file, file.name);
      editor?.chain().focus().insertContent({ type: "emailImage", attrs: { asset: asset.token, src: asset.url, width: 60, align: "center", alt: "" } }).run();
    });
  const insertButton = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent([{ type: "emailButton", attrs: { label: t("buttonWords"), href: "https://africanfreefirecommunity.com/", align: "center" } }, { type: "paragraph" }])
      .run();
    // The caret is now in the paragraph after the button. Pick the button instead, so its options
    // (words, link, position) open at once, as Gmail opens its link box on insert.
    const { $from } = editor.state.selection;
    const start = $from.before();
    const button = editor.state.doc.resolve(start).nodeBefore;
    if (button?.type.name === "emailButton") editor.commands.setNodeSelection(start - button.nodeSize);
  };
  const openDesigner = (editing: boolean) => {
    const attrs = editing ? (editor?.getAttributes("designedPicture") ?? {}) : {};
    setDesigner({ open: true, initial: (attrs.design as BoardDesign) ?? null, editing });
  };
  const designerDone = (r: DesignedResult) => {
    const attrs = { asset: r.asset, src: r.src, alt: r.alt, design: r.design };
    if (designer.editing && editor?.isActive("designedPicture")) editor.chain().focus().updateAttributes("designedPicture", attrs).run();
    else editor?.chain().focus().insertContent({ type: "designedPicture", attrs: { ...attrs, width: 100, align: "center" } }).run();
    setDesigner({ open: false, initial: null, editing: false });
  };

  const setStyleAndSave = (s: EmailStyle) => {
    setStyle(s);
    touch("style");
  };
  const setField = (k: keyof Fields, v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    touch("fields");
  };

  const langHasContent = (l: Lang) => (mode === "design" ? !!campaign.designs[l] : !docIsEmpty(docs[l]));
  const vars = useMemo(() => styleVars(style), [style]);
  const [footNote, footLink] = EMAIL_FOOTER[lang];
  const designHtml = (campaign.designs[lang] ?? campaign.designs.en)?.html ?? null;

  const iconBtn = (name: Parameters<typeof MailIcon>[0]["name"], label: string, onClick: () => void, pressed?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/10 aria-pressed:bg-background aria-pressed:text-primary focus-visible:outline-2 focus-visible:outline-ring"
    >
      <MailIcon name={name} />
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[980px] rounded-md bg-card shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-t-md bg-muted px-4 py-3 md:px-5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold">{t("composeTitle")}</h2>
          <span className={`text-xs ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`} role="status">
            {saveState === "saving" ? t("saving") : saveState === "error" ? t("notSaved") : t("saved")}
          </span>
          {saveState === "error" && (
            <button type="button" className="text-xs underline" onClick={() => flush().catch(() => undefined)}>
              {t("retry")}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="mail-start-from">
            {t("startFrom")}
          </label>
          <select
            id="mail-start-from"
            className="h-9 max-w-64 rounded-md bg-background px-2 text-sm"
            value=""
            onChange={(e) => startFrom(e.target.value)}
          >
            <option value="">{t("startFromPick")}</option>
            <option value="b:blank">{t("blank")}</option>
            <optgroup label={t("templatesGroup")}>
              {templates.map((tp) => (
                <option key={tp.token} value={`t:${tp.token}`}>
                  {tp.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("pastGroup")}>
              {pastEmails.map((c) => (
                <option key={c.token} value={`c:${c.token}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="inline-flex gap-1 rounded-md bg-background/60 p-1" role="group" aria-label={t("seeAs")}>
            {(["desk", "phone"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-sm px-3 py-1 text-sm ${view === v ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t(v === "desk" ? "computer" : "phone")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 px-2.5 pt-3 md:px-5">
        <ToLine spec={audience} onChange={(s) => { setAudience(s); touch("audience"); }} onCount={setCount} />
        <div className="flex min-h-12 flex-wrap items-center gap-2.5 rounded-md bg-background px-3 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground sm:w-20">{t("language")}</span>
          <div className="inline-flex gap-1 rounded-md bg-muted p-1" role="group" aria-label={t("language")}>
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => switchLang(l)}
                className={`rounded-sm px-3 py-1 text-sm ${lang === l ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t(`lang.${l}`)}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{t("languageHint")}</span>
        </div>
        <label className="flex min-h-12 flex-wrap items-center gap-2.5 rounded-md bg-background px-3 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground sm:w-20">{t("subject")}</span>
          <input
            className="h-9 min-w-40 flex-1 rounded-sm bg-transparent text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={fields[`subject_${lang}`]}
            maxLength={150}
            onChange={(e) => setField(`subject_${lang}`, e.target.value)}
          />
        </label>
        <label className="flex min-h-12 flex-wrap items-center gap-2.5 rounded-md bg-background px-3 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground sm:w-20">{t("previewLine")}</span>
          <input
            className="h-9 min-w-40 flex-1 rounded-sm bg-transparent text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            value={fields[`preheader_${lang}`]}
            maxLength={160}
            placeholder={t("previewLineHint")}
            onChange={(e) => setField(`preheader_${lang}`, e.target.value)}
          />
        </label>

        {lang !== "en" && mode === "write" && docIsEmpty(docs[lang]) && !docIsEmpty(docs.en) && (
          <div className="flex flex-wrap items-center gap-2.5 px-1 py-1 text-sm text-gold">
            <span>{t("noVersion", { lang: t(`langWord.${lang}`) })}</span>
            <Button type="button" size="sm" variant="secondary" onClick={copyEnglish}>
              {t("startFromEnglish")}
            </Button>
          </div>
        )}

        {mode === "design" && (
          <div className="rounded-md bg-background p-3">
            <OwnDesign campaign={campaign} lang={lang} onCampaign={(c) => setCampaign(c)} beforeUpload={flush} />
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => { setMode("write"); touch("mode"); }}>
              {t("writeHereInstead")}
            </Button>
          </div>
        )}

        <div className={`email-page mt-1.5${view === "phone" ? " phone" : ""}`} style={{ ...vars, background: vars["--m-page"] } as React.CSSProperties}>
          {mode === "write" ? (
            <div className="email-sheet relative">
              {isEmpty && <p className="pointer-events-none absolute text-muted-foreground" aria-hidden="true">{t("writeHere")}</p>}
              <EditorContent editor={editor} />
              <p className="email-foot">
                {footNote} <u>{footLink}</u>
              </p>
            </div>
          ) : designHtml ? (
            <iframe className="email-design-frame" title={t("own.previewTitle")} sandbox="" srcDoc={designHtml} />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("own.empty")}</p>
          )}
        </div>

        <details className="mt-1.5 rounded-md bg-background px-3 py-2.5">
          <summary className="cursor-pointer text-sm font-semibold">{t("tips.title")}</summary>
          <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
            <p>{t("tips.fonts")}</p>
            <p>{t("tips.pictures")}</p>
            <p>{t("tips.video")}</p>
            <p>{t("tips.length")}</p>
          </div>
        </details>
        <div className="h-2" />
      </div>

      {/* the bottom: kept on screen while the email scrolls */}
      {/* minmax(0,1fr): the bars inside may scroll sideways, but they never widen the column. */}
      <div className="email-cfoot sticky bottom-0 z-10 grid grid-cols-[minmax(0,1fr)] gap-2 rounded-b-md bg-card px-2.5 pt-2.5 pb-3 md:px-5">
        <PickedBar
          editor={mode === "write" ? editor : null}
          mode={picked}
          setMode={setPicked}
          style={style}
          onStyle={setStyleAndSave}
          onEditDesigned={() => openDesigner(true)}
        />
        {mode === "write" && fmtOpen && <FormattingBar editor={editor} style={style} />}
        <div className="flex flex-nowrap items-center gap-0.5 md:gap-1">
          <div className="mr-1 inline-flex shrink-0 md:mr-2">
            <button
              type="button"
              disabled={busy || count === 0}
              onClick={() => run(async () => setConfirmSend(true))}
              aria-label={count ? t("sendTo", { n: count }) : t("send")}
              title={count ? t("sendTo", { n: count }) : t("send")}
              className="h-10 rounded-l-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 md:px-6"
            >
              {t("send")}
            </button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("sendOptions")} className="ml-0.5 inline-flex h-10 items-center rounded-r-full bg-primary px-2 text-primary-foreground hover:bg-primary/90">
                  <MailIcon name="dropDown" className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem
                  onSelect={() =>
                    run(async () => {
                      const { to } = await mailAdmin.test(token, lang);
                      toast.success(t("testSent", { to }));
                    })
                  }
                >
                  <MailIcon name="send" className="size-4" /> {t("sendTest")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    run(async () => {
                      toast.success(t("draftSaved"));
                    })
                  }
                >
                  <MailIcon name="draft" className="size-4" /> {t("saveDraft")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run(async () => { await mailAdmin.saveTemplate(token); toast.success(t("templateSaved")); })}>
                  <MailIcon name="template" className="size-4" /> {t("saveTemplate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* The insert buttons take the room between Send and More and scroll sideways inside it
              when a phone is too narrow for all of them, so Send and More always stay in reach. */}
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:gap-1">
          {mode === "write" && (
            <>
              <button
                type="button"
                onClick={() => setFmtOpen((o) => !o)}
                aria-pressed={fmtOpen}
                aria-label={t("fmt.toggle")}
                title={t("fmt.toggle")}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold hover:bg-foreground/10 aria-pressed:bg-background aria-pressed:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                Aa
              </button>
              {iconBtn("link", t("insert.link"), () => setPicked("newlink"))}
              <label
                className="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-foreground/10"
                title={t("insert.picture")}
              >
                <MailIcon name="image" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-label={t("insert.picture")}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void insertPicture(f);
                  }}
                />
              </label>
              {iconBtn("button", t("insert.button"), insertButton)}
              {iconBtn("layers", t("insert.designed"), () => openDesigner(false))}
              {iconBtn("palette", t("insert.design"), () => setPicked(picked === "design" ? null : "design"), picked === "design")}
            </>
          )}
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={t("more")} title={t("more")} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10">
                <MailIcon name="more" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("more")}</DropdownMenuLabel>
              {mode === "write" ? (
                <DropdownMenuItem onSelect={() => { setMode("design"); setPicked(null); touch("mode"); }}>
                  <MailIcon name="code" className="size-4" /> {t("useOwnDesign")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => { setMode("write"); touch("mode"); }}>
                  <MailIcon name="code" className="size-4" /> {t("writeHereInstead")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => run(async () => setPreview(await mailAdmin.preview(token, lang)))}>
                <MailIcon name="eye" className="size-4" /> {t("seeAsSent")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run(async () => { await mailAdmin.saveTemplate(token); toast.success(t("templateSaved")); })}>
                <MailIcon name="template" className="size-4" /> {t("saveTemplate")}
              </DropdownMenuItem>
              {lang !== "en" && mode === "write" && (
                <DropdownMenuItem onSelect={copyEnglish}>
                  <MailIcon name="copy" className="size-4" /> {t("replaceWithEnglish")}
                </DropdownMenuItem>
              )}
              {/* Space, not a separator line, sets "Discard" apart (no hairlines, owner 2026-08-17). */}
              <DropdownMenuItem onSelect={() => setConfirmDiscard(true)} className="mt-2 text-destructive">
                <MailIcon name="trash" className="size-4" /> {t("discard")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!langHasContent("en") && <p className="px-1 text-xs text-muted-foreground">{t("needsEnglish")}</p>}
      </div>

      <DesignedPictureDialog
        open={designer.open}
        initial={designer.initial}
        style={style}
        onClose={() => setDesigner({ open: false, initial: null, editing: false })}
        onDone={designerDone}
      />

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmSend.title", { n: count ?? 0, nText: formatNumber(count ?? 0) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmSend.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(async () => {
                  const res = await mailAdmin.send(token);
                  toast.success(t("sending", { n: res.recipients, nText: formatNumber(res.recipients) }));
                  // Same address, so a router push would change nothing: the page fetches again instead.
                  onSent();
                })
              }
            >
              {t("send")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStart !== null} onOpenChange={(o) => !o && setConfirmStart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmStart.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmStart.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const from = confirmStart;
                setConfirmStart(null);
                if (from) void run(async () => load(await mailAdmin.startFrom(token, from)));
              }}
            >
              {t("confirmStart.go")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDiscard.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDiscard.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  dirty.current.clear();
                  await mailAdmin.discard(token);
                  router.push("/a/email-news");
                } catch (err) {
                  const code = errorCode(err);
                  toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                }
              }}
            >
              {t("discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[calc(100vh-24px)] w-[min(700px,calc(100vw-20px))] max-w-none overflow-y-auto sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("seeAsSent")}</DialogTitle>
            <DialogDescription>{t("seeAsSentHint", { kb: preview?.size_kb ?? 0 })}</DialogDescription>
          </DialogHeader>
          {preview && <iframe title={t("seeAsSent")} sandbox="" srcDoc={preview.html} className="h-[70vh] w-full rounded-md bg-background" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
