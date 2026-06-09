// parseUserAgent: turn a raw User-Agent string into a short, human-readable device label.
//
// Used wherever we surface a stored user_agent to an admin: the audit-log details (AuditLogPanel),
// the Settings "Login History" tab, and the player login history. Both AuditLog and LoginHistory
// persist the raw user_agent on the backend; this is the display-side formatter (no dependency, so
// it works without adding a UA-parsing package).
//
// Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/120 Safari/537.36"
//          -> "Chrome on Windows (Desktop)"

export function parseUserAgent(ua?: string | null): string {
  if (!ua || !ua.trim()) return "Unknown device";
  const s = ua;

  // ── Operating system / device ──────────────────────────────────────────────
  let os = "Unknown OS";
  if (/iPhone/.test(s)) os = "iPhone";
  else if (/iPad/.test(s)) os = "iPad";
  else if (/Android/.test(s)) os = "Android";
  else if (/Windows NT/.test(s) || /Windows/.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";

  // ── Browser (order matters: Edge/Opera masquerade as Chrome) ───────────────
  let browser = "Browser";
  if (/Edg(A|iOS|e)?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Version\/.+Safari/.test(s)) browser = "Safari";
  else if (/Safari\//.test(s)) browser = "Safari";

  // ── Form factor ────────────────────────────────────────────────────────────
  const kind = /Mobile|Android|iPhone|iPod/.test(s)
    ? "Mobile"
    : /iPad|Tablet/.test(s)
      ? "Tablet"
      : "Desktop";

  return `${browser} on ${os} (${kind})`;
}
