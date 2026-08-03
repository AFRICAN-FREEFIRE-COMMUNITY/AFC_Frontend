"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EventRequirementsCard (owner 2026-06-20)
//
// Shows, on the PUBLIC event page and BEFORE the user tries to register, exactly what this event
// requires of registrants: the per-player / per-team registration ASSETS the organizer toggled on
// (team logo, esports image, Free Fire UID, profile image, WhatsApp number) AND, for a sponsored
// event, what the sponsor asks each registrant to submit. Purely informational + read-only so a user
// knows the bar up front instead of discovering it only when registration blocks them.
//
// Distinct from SponsorRequirementsCard (which is the registered user's post-registration submission
// status + rejection loop). This card renders for EVERYONE viewing the event, registered or not, and
// returns null when the event has no asset requirements and is not sponsored.
//
// Data: all fields come from get_event_details (afc_tournament_and_scrims.views.get_event_details),
// consumed by EventDetailsWrapper, which renders this card. The asset flags are enforced server-side
// in register_for_event via _missing_registration_assets; this is the user-facing heads-up for them.
// ─────────────────────────────────────────────────────────────────────────────
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconClipboardCheck, IconCircleCheck } from "@tabler/icons-react";

interface EventRequirementsCardProps {
  requireTeamLogo?: boolean;
  requireEsportImages?: boolean;
  requirePlayerUid?: boolean;
  requirePlayerProfileImage?: boolean;
  // Event.require_whatsapp (owner 2026-08-03): every registering player needs a WhatsApp number on
  // their profile, because this event sends room details there. Same shape as the flags above.
  requireWhatsapp?: boolean;
  isSponsored?: boolean;
  sponsorName?: string | null;
  sponsorRequirementDescription?: string | null;
  sponsorFieldLabel?: string | null;
}

export function EventRequirementsCard({
  requireTeamLogo,
  requireEsportImages,
  requirePlayerUid,
  requirePlayerProfileImage,
  requireWhatsapp,
  isSponsored,
  sponsorName,
  sponsorRequirementDescription,
  sponsorFieldLabel,
}: EventRequirementsCardProps) {
  const t = useTranslations("tournaments");

  // The asset requirements toggled on for this event.
  const assetItems: string[] = [];
  if (requireTeamLogo) assetItems.push(t("requirements.teamLogo"));
  if (requireEsportImages) assetItems.push(t("requirements.esportImage"));
  if (requirePlayerUid) assetItems.push(t("requirements.uid"));
  if (requirePlayerProfileImage) assetItems.push(t("requirements.profileImage"));
  if (requireWhatsapp) assetItems.push(t("requirements.whatsapp"));

  const hasSponsorReq =
    !!isSponsored && !!(sponsorRequirementDescription || sponsorFieldLabel);

  // Nothing required + no sponsor ask -> render nothing (keep the page clean).
  if (assetItems.length === 0 && !hasSponsorReq) return null;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <IconClipboardCheck className="size-5 text-primary" />
          {t("requirements.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm">
        {assetItems.length > 0 && (
          <div>
            <p className="mb-2 text-muted-foreground">{t("requirements.intro")}</p>
            <ul className="space-y-1.5">
              {assetItems.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <IconCircleCheck className="size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasSponsorReq && (
          <div className={assetItems.length > 0 ? "border-t pt-4" : ""}>
            <p className="mb-1 font-medium">
              {sponsorName
                ? t("requirements.sponsorTitleNamed", { sponsor: sponsorName })
                : t("requirements.sponsorTitle")}
            </p>
            {sponsorRequirementDescription && (
              <p className="text-muted-foreground">{sponsorRequirementDescription}</p>
            )}
            {sponsorFieldLabel && (
              <p className="mt-1 text-muted-foreground">
                {t("requirements.sponsorField", { field: sponsorFieldLabel })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
