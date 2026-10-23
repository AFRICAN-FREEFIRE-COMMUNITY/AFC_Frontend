// components/qr/qrDownload.ts
// ─────────────────────────────────────────────────────────────────────────────
// The three downloads the QR dialog offers (inbox #46): plain PNG, plain SVG, and the card PNG.
//
// The plain files are encoded here in the browser with `qrcode` rather than by serialising the
// on-screen react-qr-code SVG, so each file carries its own white field and a 4-module quiet zone
// (the margin a scanner needs) no matter where it is later pasted: a designer dropping the SVG onto
// a dark poster still gets a code that scans. Same string, same error correction ("M") as the
// on-screen code, so the files and the screen are the same symbol.
//
// The card PNG is drawn by the server (app/qr/[token]/card/route.tsx); this only saves it.
// Caller: components/qr/QrShareButton.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import QRCode from "qrcode";

const DARK = "#0b0d10";
const LIGHT = "#ffffff";
const PNG_SIZE = 1024; // big enough for print at ~8 cm, small enough to post
const QUIET_ZONE = 4;  // modules; the ISO 18004 minimum

function save(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  save(url, filename);
  // Revoke on the next tick: some browsers start the download asynchronously
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "afc-qr-team-1-million-esport": readable, safe on every file system. */
export function qrFilename(targetType: string, name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `afc-qr-${targetType}${slug ? `-${slug}` : ""}`;
}

export async function downloadQrPng(value: string, filename: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: QUIET_ZONE,
    width: PNG_SIZE,
    color: { dark: DARK, light: LIGHT },
  });
  save(dataUrl, `${filename}.png`);
}

export async function downloadQrSvg(value: string, filename: string): Promise<void> {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: QUIET_ZONE,
    color: { dark: DARK, light: LIGHT },
  });
  saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
}

/** Saves the server-drawn card. Throws when the card could not be fetched, so the caller can say so. */
export async function downloadCard(cardUrl: string, filename: string): Promise<void> {
  const res = await fetch(cardUrl);
  if (!res.ok) throw new Error(`card ${res.status}`);
  saveBlob(await res.blob(), `${filename}-card.png`);
}
