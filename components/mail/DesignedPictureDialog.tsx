"use client";

// components/mail/DesignedPictureDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The designed picture (inbox #284, owner 2026-10-16: "should be able to move to the exact place you
// want image to be or if you want text aon top text or behind text or change transpaceny of image
// uploaded also"). Pictures and words as layers on a board: drag them anywhere (arrow keys nudge),
// put any one in front of or behind the others, change transparency, size, colour and font.
//
// WHY ONE PICTURE: email apps do not layer pictures and words reliably (Gmail drops positioned
// layouts, Outlook ignores transparency), so on Done the board is drawn into one PNG here, exactly
// as it looks, and uploaded through AFC's picture checks (POST mail/assets/). Its words become the
// picture's description. The layers stay on the editor node (`design`) so it can be opened again.
// Pictures on the board are drawn from blobs fetched through the API (assetBytes), so the canvas is
// never "tainted" by another origin and can be exported.
//
// CONNECTS TO: components/mail/Composer.tsx (opens it, inserts/updates the designedPicture node),
// lib/mailApi.ts, emailStyle.ts (fonts), useEmailFonts.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorCode, mailAdmin, type Asset, type EmailStyle } from "@/lib/mailApi";
import { fontNames, fontStack } from "./emailStyle";

export type Layer = {
  id: string;
  kind: "pic" | "text";
  x: number;
  y: number;
  z: number;
  opacity: number;
  asset?: string;
  w?: number;
  text?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  font?: string;
};
export type BoardDesign = { h: number; bg: string; layers: Layer[] };
export type DesignedResult = { asset: string; src: string; alt: string; design: BoardDesign };

const BOARD_W = 600;
const BGS = ["#13201a", "#0d1410", "#1c1f26", "#fbfcfb"];
const INK = ["#ffffff", "#16a34a", "#eab308", "#0d1410"];

const newId = () => "l" + Math.random().toString(36).slice(2, 8);
const topZ = (layers: Layer[]) => layers.reduce((m, l) => Math.max(m, l.z), 0);

export function DesignedPictureDialog({
  open,
  initial,
  style,
  onClose,
  onDone,
}: {
  open: boolean;
  initial: BoardDesign | null;
  style: EmailStyle;
  onClose: () => void;
  onDone: (result: DesignedResult, newAssets: Asset[]) => void;
}) {
  const t = useTranslations("emailNews");
  const [design, setDesign] = useState<BoardDesign>({ h: 260, bg: BGS[0], layers: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  const blobsRef = useRef(blobs);
  useEffect(() => {
    blobsRef.current = blobs;
  }, [blobs]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const added = useRef<Asset[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  // Opening: start from the node's layers (or an empty board) and fetch its pictures as blobs.
  useEffect(() => {
    if (!open) return;
    const start = initial ?? { h: 260, bg: BGS[0], layers: [] };
    setDesign(start);
    setSelected(null);
    setError(null);
    added.current = [];
    for (const l of start.layers) {
      if (l.kind === "pic" && l.asset && !blobsRef.current[l.asset]) {
        const token = l.asset;
        mailAdmin
          .assetBytes(token)
          .then((bytes) => setBlobs((b) => ({ ...b, [token]: URL.createObjectURL(new Blob([bytes])) })))
          .catch(() => setError(t("designed.pictureMissing")));
      }
    }
    // Runs when the dialog opens (the composer hands over a stable `initial`); the blobs cache outlives it.
  }, [open, initial, t]);

  const layer = design.layers.find((l) => l.id === selected) ?? null;
  const update = (id: string, patch: Partial<Layer>) =>
    setDesign((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const addPicture = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const asset = await mailAdmin.upload("image", file, file.name);
      added.current.push(asset);
      setBlobs((b) => ({ ...b, [asset.token]: URL.createObjectURL(file) }));
      const id = newId();
      setDesign((d) => ({ ...d, layers: [...d.layers, { id, kind: "pic", asset: asset.token, x: 180, y: 20, w: 240, opacity: 1, z: topZ(d.layers) + 1 }] }));
      setSelected(id);
    } catch (err) {
      const code = errorCode(err);
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setBusy(false);
    }
  };

  const addWords = () => {
    const id = newId();
    setDesign((d) => ({
      ...d,
      layers: [...d.layers, { id, kind: "text", text: t("designed.yourWords"), x: 30, y: 30, size: 36, color: "#ffffff", bold: true, font: "DM Sans", opacity: 1, z: topZ(d.layers) + 1 }],
    }));
    setSelected(id);
  };

  // Dragging: positions are kept in board pixels (600 wide), whatever size the board shows at.
  const startDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, l: Layer) => {
    e.preventDefault();
    setSelected(l.id);
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser cannot capture (a scripted test event) still drags through the listeners below.
    }
    const scale = (boardRef.current?.getBoundingClientRect().width ?? BOARD_W) / BOARD_W;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = l.x;
    const oy = l.y;
    const move = (ev: PointerEvent) => {
      const x = Math.round(Math.max(-500, Math.min(590, ox + (ev.clientX - sx) / scale)));
      const y = Math.round(Math.max(-500, oy + (ev.clientY - sy) / scale));
      setDesign((d) => ({ ...d, layers: d.layers.map((x2) => (x2.id === l.id ? { ...x2, x, y: Math.min(y, d.h - 10) } : x2)) }));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }, []);

  const nudge = (e: React.KeyboardEvent, l: Layer) => {
    const step = e.shiftKey ? 20 : 4;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault();
    setSelected(l.id);
    update(l.id, { x: l.x + d[0], y: l.y + d[1] });
  };

  // Done: draw the board at twice its size, exactly as shown, and upload it as a picture.
  const finish = async () => {
    setError(null);
    setBusy(true);
    try {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = BOARD_W * scale;
      canvas.height = design.h * scale;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("no canvas");
      g.scale(scale, scale);
      g.fillStyle = design.bg;
      g.fillRect(0, 0, BOARD_W, design.h);
      await document.fonts.ready;
      for (const l of [...design.layers].sort((a, b) => a.z - b.z)) {
        g.globalAlpha = l.opacity;
        if (l.kind === "pic" && l.asset && blobs[l.asset]) {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = blobs[l.asset as string];
          });
          const w = l.w ?? 240;
          g.drawImage(img, l.x, l.y, w, (w * img.naturalHeight) / img.naturalWidth);
        } else if (l.kind === "text") {
          g.font = `${l.bold ? 700 : 400} ${l.size ?? 36}px ${fontStack(l.font ?? "DM Sans", style)}`;
          g.fillStyle = l.color ?? "#ffffff";
          g.textBaseline = "top";
          g.fillText(l.text ?? "", l.x, l.y + (l.size ?? 36) * 0.05);
        }
      }
      g.globalAlpha = 1;
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no blob"))), "image/png"));
      const asset = await mailAdmin.upload("image", blob, "designed-picture.png");
      const alt = [...design.layers]
        .filter((l) => l.kind === "text" && l.text)
        .sort((a, b) => a.z - b.z)
        .map((l) => l.text)
        .join(". ");
      onDone({ asset: asset.token, src: asset.url, alt, design }, [...added.current, asset]);
    } catch (err) {
      const code = errorCode(err);
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...design.layers].sort((a, b) => a.z - b.z);
  const range = (label: string, min: number, max: number, value: number, fmt: (v: number) => string, set: (v: number) => void) => (
    <label className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)_auto]">
      <span className="col-span-2 sm:col-span-1">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full accent-primary" />
      <output className="text-muted-foreground">{fmt(value)}</output>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[calc(100vh-24px)] w-[min(760px,calc(100vw-20px))] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{t("designed.title")}</DialogTitle>
          <DialogDescription>{t("designed.hint")}</DialogDescription>
        </DialogHeader>
        <div
          ref={boardRef}
          className="email-board"
          style={{ aspectRatio: `${BOARD_W} / ${design.h}`, background: design.bg }}
          aria-label={t("designed.board")}
        >
          {sorted.map((l) => (
            <div
              key={l.id}
              role="button"
              tabIndex={0}
              aria-label={l.kind === "pic" ? t("designed.pictureLayer") : t("designed.wordsLayer", { words: l.text ?? "" })}
              className={`layer${selected === l.id ? " sel" : ""}`}
              onPointerDown={(e) => startDrag(e, l)}
              onKeyDown={(e) => nudge(e, l)}
              onFocus={() => setSelected(l.id)}
              style={{
                left: `${l.x / 6}%`,
                top: `${(l.y / design.h) * 100}%`,
                width: l.kind === "pic" ? `${(l.w ?? 240) / 6}%` : undefined,
                opacity: l.opacity,
                zIndex: l.z,
                fontSize: l.kind === "text" ? `calc(${l.size ?? 36} / 600 * 100cqw)` : undefined,
                color: l.color,
                fontWeight: l.bold ? 700 : 400,
                fontFamily: l.kind === "text" ? fontStack(l.font ?? "DM Sans", style) : undefined,
              }}
            >
              {l.kind === "pic" ? (l.asset && blobs[l.asset] ? <img src={blobs[l.asset]} alt="" draggable={false} /> : null) : l.text || " "}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative inline-flex h-9 cursor-pointer items-center overflow-hidden rounded-md bg-muted px-3 text-sm font-medium hover:bg-muted/70">
            {t("designed.addPicture")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void addPicture(f);
              }}
            />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={addWords}>
            {t("designed.addWords")}
          </Button>
          <span className="ml-1 text-xs text-muted-foreground">{t("designed.background")}</span>
          {BGS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t("designed.backgroundColour", { colour: c })}
              aria-pressed={design.bg === c}
              onClick={() => setDesign((d) => ({ ...d, bg: c }))}
              className="relative grid size-8 place-items-center rounded-full"
              style={{ background: c }}
            >
              {design.bg === c && <span className="size-3 rounded-full bg-[#7a7f87]" />}
            </button>
          ))}
          <input
            type="color"
            value={design.bg}
            onChange={(e) => setDesign((d) => ({ ...d, bg: e.target.value }))}
            aria-label={t("designed.anyBackground")}
            className="size-8 cursor-pointer rounded-md bg-transparent p-0"
          />
        </div>
        {range(t("designed.height"), 120, 600, design.h, (v) => t("px", { n: v }), (v) => setDesign((d) => ({ ...d, h: v })))}

        {layer ? (
          <div className="grid gap-3 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-semibold">{layer.kind === "pic" ? t("designed.pictureLayer") : t("designed.wordsTitle")}</p>
            {layer.kind === "text" && (
              <>
                <input
                  className="h-9 rounded-md bg-background px-3 text-sm"
                  value={layer.text ?? ""}
                  onChange={(e) => update(layer.id, { text: e.target.value })}
                  aria-label={t("designed.words")}
                />
                <label className="grid grid-cols-1 items-center gap-1 text-sm sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
                  <span>{t("designed.font")}</span>
                  <select className="h-9 rounded-md bg-background px-2 text-sm" value={layer.font ?? "DM Sans"} onChange={(e) => update(layer.id, { font: e.target.value })}>
                    {fontNames(style).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {range(t("designed.size"), 12, 120, layer.size ?? 36, (v) => t("px", { n: v }), (v) => update(layer.id, { size: v }))}
                <div className="flex flex-wrap items-center gap-2">
                  {INK.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={t("designed.wordsColour", { colour: c })}
                      aria-pressed={layer.color === c}
                      onClick={() => update(layer.id, { color: c })}
                      className="relative grid size-8 place-items-center rounded-full"
                      style={{ background: c }}
                    >
                      {layer.color === c && <span className="size-3 rounded-full bg-[#7a7f87]" />}
                    </button>
                  ))}
                  <input type="color" value={layer.color ?? "#ffffff"} onChange={(e) => update(layer.id, { color: e.target.value })} aria-label={t("designed.anyColour")} className="size-8 cursor-pointer rounded-md bg-transparent p-0" />
                  <Button type="button" size="sm" variant={layer.bold ? "default" : "secondary"} aria-pressed={!!layer.bold} onClick={() => update(layer.id, { bold: !layer.bold })}>
                    {t("designed.bold")}
                  </Button>
                </div>
              </>
            )}
            {layer.kind === "pic" && range(t("designed.size"), 40, 600, layer.w ?? 240, (v) => t("px", { n: v }), (v) => update(layer.id, { w: v }))}
            {range(t("designed.transparency"), 0, 90, Math.round((1 - layer.opacity) * 100), (v) => t("percent", { n: v }), (v) => update(layer.id, { opacity: 1 - v / 100 }))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => update(layer.id, { z: topZ(design.layers) + 1 })}>
                {t("designed.front")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => update(layer.id, { z: Math.min(...design.layers.map((l) => l.z)) - 1 })}>
                {t("designed.back")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDesign((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== layer.id) }));
                  setSelected(null);
                }}
              >
                {t("remove")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("designed.pressOne")}</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void finish()} disabled={busy || design.layers.length === 0}>
            {busy ? t("designed.drawing") : t("done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
