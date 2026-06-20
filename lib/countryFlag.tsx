"use client";

// ── countryFlag ──────────────────────────────────────────────────────────────
// Country -> flag, shown beside team names across the site (owner 2026-06-20). Accepts WHATEVER shape
// Team.country / User.country holds: a 2-letter ISO code ("NG") OR a full name ("Nigeria") - both map to
// the same flag (the backend stores a mix). Renders a small flag IMAGE (flagcdn CDN, no bundled assets)
// or nothing when the country can't be resolved, so an unknown value never shows a broken icon.
//
// Team country itself is AUTO-derived server-side from the majority of the team's players' locations
// (tie -> team owner's country); see afc_team _derive_team_country. This module is purely the display.
//
// Used by: components/ui/entity-link.tsx (TeamLink, which propagates flags to most team-name surfaces)
// and directly on the team detail page + profile.
import * as React from "react";

// Full country NAME (lowercased) -> ISO-3166 alpha-2. ISO codes are handled separately (2-letter input
// is treated as a code), so this only needs the spelled-out names we actually receive. Focused on
// Africa (the community's base) + the common non-African countries present in the data. Unknown -> no flag.
const NAME_TO_ISO2: Record<string, string> = {
  // ── Africa ──
  algeria: "DZ", angola: "AO", benin: "BJ", botswana: "BW", "burkina faso": "BF",
  burundi: "BI", "cabo verde": "CV", "cape verde": "CV", cameroon: "CM",
  "central african republic": "CF", chad: "TD", comoros: "KM",
  congo: "CG", "republic of the congo": "CG", "congo, the democratic republic of the": "CD",
  "democratic republic of the congo": "CD", "dr congo": "CD", drc: "CD",
  "cote d'ivoire": "CI", "côte d'ivoire": "CI", "ivory coast": "CI",
  djibouti: "DJ", egypt: "EG", "equatorial guinea": "GQ", eritrea: "ER",
  eswatini: "SZ", swaziland: "SZ", ethiopia: "ET", gabon: "GA", gambia: "GM", "the gambia": "GM",
  ghana: "GH", guinea: "GN", "guinea-bissau": "GW", kenya: "KE", lesotho: "LS",
  liberia: "LR", libya: "LY", madagascar: "MG", malawi: "MW", mali: "ML",
  mauritania: "MR", mauritius: "MU", morocco: "MA", mozambique: "MZ", namibia: "NA",
  niger: "NE", nigeria: "NG", rwanda: "RW",
  "sao tome and principe": "ST", "são tomé and príncipe": "ST",
  senegal: "SN", seychelles: "SC", "sierra leone": "SL", somalia: "SO",
  "south africa": "ZA", "south sudan": "SS", sudan: "SD", tanzania: "TZ",
  "tanzania, united republic of": "TZ", togo: "TG", tunisia: "TN", uganda: "UG",
  zambia: "ZM", zimbabwe: "ZW",
  // ── Common non-African ──
  portugal: "PT", brazil: "BR", france: "FR", spain: "ES", germany: "DE",
  "united kingdom": "GB", "united states": "US", "united states of america": "US",
  india: "IN", indonesia: "ID", pakistan: "PK", canada: "CA", netherlands: "NL",
  italy: "IT", "saudi arabia": "SA", "united arab emirates": "AE", turkey: "TR", "türkiye": "TR",
};

// Resolve a country string (ISO-2 code OR full name) to an uppercase ISO-2 code, or null if unknown.
export function countryToIso2(country?: string | null): string | null {
  if (!country) return null;
  const raw = country.trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase(); // already an ISO-2 code (e.g. "NG")
  return NAME_TO_ISO2[raw.toLowerCase()] ?? null;
}

// A small inline flag for a country. Renders nothing for an unresolvable country (graceful). Uses the
// flagcdn CDN (raw <img> so no next/image host config is needed); w40 is a documented flagcdn size.
export function CountryFlag({
  country,
  className,
  title,
}: {
  country?: string | null;
  className?: string;
  title?: string;
}) {
  const iso = countryToIso2(country);
  if (!iso) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt={title ?? country ?? iso}
      title={title ?? country ?? iso}
      width={18}
      height={14}
      loading="lazy"
      className={className}
      style={{ display: "inline-block", borderRadius: 2, objectFit: "cover", verticalAlign: "-2px" }}
    />
  );
}
