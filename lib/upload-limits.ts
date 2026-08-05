// ─────────────────────────────────────────────────────────────────────────────
// upload-limits
// ----------------------------------------------------------------------------
// One place that knows how big an upload may be, and how to explain an upload that
// failed. Used by every surface that POSTs a file as multipart/form-data:
//   • app/(organizer)/organizer/events/create/page.tsx   (event banner + rules PDF)
//   • app/(a)/a/events/create/page.tsx                   (same, admin)
//   • app/(organizer)/organizer/events/[slug]/edit/page.tsx
//   • app/(a)/a/events/[slug]/edit/page.tsx
//
// WHY THIS EXISTS (owner-reported 2026-08-05, urgent: an organizer could not create an
// event and got "An unexpected error occurred during submission").
//
// The request never reached Django. nginx in front of the API enforces
// `client_max_body_size`, and it rejects an over-sized body ITSELF, with a 413 that
// carries no CORS headers. Measured against production that day:
//
//     banner  4.3MB -> 401 (reached Django, auth rejected the probe token)
//     banner   10MB -> 401 (reached Django)
//     banner   11MB -> 413 from nginx, and the response had NO
//                      access-control-allow-origin, while the 401 control DID
//
// A response the browser is not allowed to read makes `fetch` REJECT rather than
// resolve, so the calling code lands in `catch` with a TypeError and no status to
// inspect - which is why every one of these pages showed the same useless
// "unexpected error" no matter what actually went wrong.
//
// So: refuse a too-big file up front with a message naming the real size and the real
// limit, and when a request does fail, say which of the three things happened
// (too large / offline / server fault) instead of one catch-all.
// ─────────────────────────────────────────────────────────────────────────────

// Keep IN SYNC with nginx's `client_max_body_size` on the API host. The server value must
// stay comfortably ABOVE this one, because the multipart body is the file PLUS every other
// form field - a limit set exactly equal to the server's would let a 10MB banner fail on
// the few KB of event fields travelling with it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Reject a file that nginx would reject anyway, while we can still say something useful.
 * Returns a ready-to-toast message, or null when the file is fine.
 *
 * Checked BEFORE the request is built, so the user is told at the moment they can act on
 * it rather than after filling in a whole wizard.
 */
export function checkUploadSize(file: File | null | undefined, label: string): string | null {
  if (!file) return null;
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `${label} is ${formatBytes(file.size)}, which is over the ${formatBytes(
    MAX_UPLOAD_BYTES,
  )} limit. Please compress it or pick a smaller file and try again.`;
}

/**
 * Turn whatever `fetch` threw into something a non-technical organizer can act on.
 *
 * `fetch` rejects with a bare TypeError for ALL of: a blocked (CORS-less) response such as
 * nginx's 413, a dropped connection, and DNS failure. The thrown value cannot tell them
 * apart, so we use what we DO know - whether a file was attached and how big it was, and
 * whether the browser thinks it is online - to give the most likely cause rather than a
 * generic apology.
 *
 * @param files  the files that were attached to the failed request, largest-first order
 *               does not matter; any one of them being large makes size the top suspect.
 */
export function describeSubmitFailure(files: Array<File | null | undefined> = []): string {
  const attached = files.filter(Boolean) as File[];
  const biggest = attached.sort((a, b) => b.size - a.size)[0];

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again - nothing was saved.";
  }
  if (biggest && biggest.size > MAX_UPLOAD_BYTES) {
    return `The upload was rejected because ${biggest.name || "a file"} is ${formatBytes(
      biggest.size,
    )}, over the ${formatBytes(MAX_UPLOAD_BYTES)} limit. Pick a smaller file and try again.`;
  }
  if (biggest) {
    return `The upload could not be completed. ${
      biggest.name || "The file"
    } may be too large for the server, or the connection dropped part-way. Nothing was saved - try a smaller image, or try again.`;
  }
  return "Could not reach the server, so nothing was saved. Check your connection and try again.";
}
