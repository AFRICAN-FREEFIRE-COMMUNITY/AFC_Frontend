// lib/providerBrands.ts
// ─────────────────────────────────────────────────────────────────────────────
// Official brand marks for the outside accounts a player can link, keyed by the provider slug the
// backend sends (afc_auth/connections/registry.py).
//
// WHY A MAP AND NOT AN ICON FONT
//   These are other companies' trademarks, not decoration. Each one is used on their terms, at
//   their proportions, in their colour, or not at all. A shared icon set would tempt somebody to
//   recolour them to match AFC's palette, which is exactly what the terms forbid.
//
// WHY THE FILES ARE SELF-HOSTED RATHER THAN HOTLINKED
//   v-ent.co publishes its mark at a stable URL and AFC could point at it directly. It does not,
//   for two reasons. A hotlink breaks the moment they reorganise their assets, and it would send
//   every AFC visitor's IP and referring page to v-ent.co on a screen they may never use. The file
//   is 1KB; copying it costs nothing and leaks nothing.
//
// WHERE THE V-ENT MARK CAME FROM
//   GET https://api.v-ent.co/api/v1/ (no key required, on purpose: "somebody deciding whether to
//   integrate has not got one yet"). Its `brand` block gives the PNG, the SVG, the colour and the
//   usage terms. Fetched 2026-08-28 from the `logo_svg` it names:
//
//       https://v-ent.co/images/logo_mark_red.svg  ->  public/brands/v-ent.svg
//
//   Their stated terms, quoted so the next person does not have to go and find them:
//     "Use the mark to say where the data came from, at its own proportions and no smaller than
//      24px tall. Do not recolour it, stretch it, or use it in a way that suggests V-ENT endorses
//      your product. Prefer the SVG; it stays sharp at every size, which the PNG will not."
//
//   What the renderer therefore must do, and what ConnectedAccounts.tsx does:
//     • object-contain with an auto width, never object-cover and never a fixed square, because
//       the artwork is 80x83 and cropping it to a circle would be stretching it by another name
//     • at least 24px tall. It renders at 36px, comfortably above the floor
//     • no CSS filter, no currentColor, no opacity games. The red is theirs
//
// NO MARK FOR DISCORD OR GOOGLE
//   Deliberate. AFC has no licensed copy of either, and both carry their own branding rules that
//   nobody here has read. Those rows keep the neutral letter avatar, which claims nothing. Add a
//   mark only when somebody has actually checked the terms for it.
//
// USED BY
//   • app/(user)/profile/_components/ConnectedAccounts.tsx - the Connect / Disconnect rows
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderBrand = {
  /** Path under /public. */
  src: string;
  /** Brand colour, for reference. Nothing tints the mark with it; the artwork carries its own. */
  colour: string;
};

export const PROVIDER_BRANDS: Record<string, ProviderBrand> = {
  vent: { src: "/brands/v-ent.svg", colour: "#ED1C24" },
};

/** The mark for a provider slug, or null when AFC has no licensed artwork for it. */
export function providerBrand(slug: string): ProviderBrand | null {
  return PROVIDER_BRANDS[slug] ?? null;
}
