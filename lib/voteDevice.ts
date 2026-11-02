/**
 * lib/voteDevice.ts - the browser's own random id, sent with an awards vote.
 *
 * WHY (inbox #453, owner 2 Nov 2026): one of the vote safety flags is "several accounts voted from
 * one device". The site has no device id, so the vote sheet keeps a random one in this browser's
 * storage and sends it with each vote. The server never stores it as sent: it keeps a keyed hash per
 * poll (afc_polls/vote_tracking.py), which can only say "these ballots came from the same browser".
 * Clearing site data or a private window gives a new id, so a shared id is a reason to look, never
 * proof, and the admin review says so.
 *
 * Storage can be missing or throw (private mode, blocked site data), so every access is wrapped and
 * the vote works the same without it: the id is then simply not sent.
 *
 * CALLERS: app/(user)/awards/_kol/KolContext.tsx (castVote). Shape checked server-side by
 * afc_polls.vote_tracking.clean_device_key (16 to 64 of A-Z a-z 0-9 _ -).
 */
const STORAGE_KEY = "afc_vote_device";
const ID_BYTES = 16;

function randomId(): string {
  const bytes = new Uint8Array(ID_BYTES);
  crypto.getRandomValues(bytes);
  return "dev_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** This browser's vote device id, created on first use; "" when storage is unavailable. */
export function voteDeviceKey(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && /^dev_[0-9a-f]{32}$/.test(existing)) return existing;
    const created = randomId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}
