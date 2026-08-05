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

// Keep IN SYNC with nginx's `client_max_body_size` on the API host
// (/etc/nginx/sites-available/django_app line 11). The server value must stay comfortably
// ABOVE this one, because the multipart body is the file PLUS every other form field - a
// limit set exactly equal to the server's would let a max-size banner fail on the few KB of
// event fields travelling with it.
//
// 2026-08-05: nginx raised 10M -> 25M so organizers could upload bigger banners and logos,
// and this per-FILE limit raised to 20MB to match (owner's call). Verified against
// production after the reload: 11/15/20MB now reach Django, 30/40MB are still refused, so
// the ceiling moved without disappearing. Note nginx's "25M" is 25 MiB = 26,214,400 bytes,
// which leaves ~6MB of headroom above this limit for the rest of the form.
//
// RAISING THIS ALONE IS NOT ENOUGH - nginx has to be raised first, or the browser gets a
// CORS-less 413 it cannot read and the user is back to an unexplainable failure.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB per file

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Format a size against the limit so the two never PRINT as the same number.
 *
 * A file of 21,000,000 bytes is 20.03MB, which at one decimal renders as "20.0 MB" - the
 * same string as the 20MB limit, giving "is 20.0 MB, which is over the 20.0 MB limit". That
 * reads as a bug to whoever hits it, and this module exists precisely to stop confusing
 * upload messages. Add decimals until the two differ, capped so we never print a wall of
 * digits at somebody.
 */
function formatAgainstLimit(bytes: number): string {
  for (let decimals = 1; decimals <= 3; decimals++) {
    const size = formatBytes(bytes, decimals);
    if (size !== formatBytes(MAX_UPLOAD_BYTES, decimals)) return size;
  }
  return formatBytes(bytes, 3);
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
  return `${label} is ${formatAgainstLimit(file.size)}, which is over the ${formatBytes(
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
    return `The upload was rejected because ${biggest.name || "a file"} is ${formatAgainstLimit(
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
