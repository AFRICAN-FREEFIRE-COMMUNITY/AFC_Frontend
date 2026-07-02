// ── Client-side image downscale before upload (owner 2026-07-02) ────────────────
// WHY: phone photos are 3-10MB+ and were bouncing off the server's body-size limit with a
// generic "failed to upload" - users had no idea size was the problem. Shrinking in the browser
// (canvas resize to <=1600px, JPEG q0.85) makes every normal photo a few hundred KB, so uploads
// just work on any connection AND the server-side limits become unreachable in practice.
//
// CONSUMERS: the esport-image widgets (profile edit, onboarding, MemberSelfEditModal) and the
// broadcast media panel's admin upload (MediaAuditCard). Pass-through for small files, non-images
// and any canvas failure (never blocks an upload it can't improve - the server still validates).

const MAX_DIMENSION = 1600; // px, longest side after downscale
const SKIP_BELOW_BYTES = 900 * 1024; // already small - do not touch (keeps PNG logos w/ alpha)

export async function compressImageForUpload(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.size < SKIP_BELOW_BYTES) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    // Only swap when compression actually helped (a photo always will).
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file; // fail-open: the original file is still a valid upload attempt
  }
}
