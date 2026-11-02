/**
 * app/(user)/awards/_kol/fonts.ts - the two faces of the KOL Awards pages, loaded for this route only.
 *
 * next/font injects the @font-face (and the preload) on the pages that import this file, so the rest
 * of the site pays nothing for them. Agdasima Bold is the small-caps display face of the Detty Royale
 * identity AND the fallback behind Graffiti City in the titles (Garena holds that licence; kol.css
 * loads it). Chakra
 * Petch is the body face. Both are set as CSS variables, which kol.css reads.
 */
import { Agdasima, Chakra_Petch } from "next/font/google";

export const kolSub = Agdasima({ subsets: ["latin"], weight: ["700"], variable: "--font-kol-sub", display: "swap" });
export const kolBody = Chakra_Petch({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-kol-body", display: "swap" });
