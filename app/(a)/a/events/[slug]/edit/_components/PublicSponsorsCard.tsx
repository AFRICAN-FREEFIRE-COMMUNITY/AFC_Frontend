"use client";

// ── PublicSponsorsCard ────────────────────────────────────────────────────────────────────────
// Logos an event shows to EVERY visitor, asking nothing of them (owner 2026-08-05, backlog 26:
// "sponsor logos and sponsor links visible to everyone").
//
// WHY THIS IS SEPARATE FROM THE SPONSORSHIP BUILDER ABOVE IT. AFC has two sponsor concepts and
// they are opposites:
//   * afc_sponsors.EventSponsorship is a GATE. Its whole reason to exist is requires_approval and
//     engagements - follow this account, join that group, and a registration that does not
//     complete until the sponsor approves it. It also needs a Sponsor ENTITY, which only an AFC
//     sponsor-admin can create, so an organizer cannot make one.
//   * This is decoration. A strip of logos on the public page. Anybody who may edit the event may
//     add one, which is what the owner asked for ("organizers and admins can add").
// Mixing them would mean every query that reasons about "the sponsors of this event" first has to
// work out whether a row is a real gate or a picture, and getting that wrong in either direction
// is a registration bug.
//
// CONNECTS TO:
//   • POST   events/public-sponsors/add/                    (add)
//   • POST   events/public-sponsors/<id>/update/            (rename / relink / replace logo)
//   • DELETE events/public-sponsors/<id>/delete/            (remove)
//   All three are gated by the SAME permission as edit_event and return the FULL updated list, so
//   this component replaces its state from the response and never re-fetches.
//   • Rendered publicly by app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx,
//     which reads `public_sponsors` off both event-detail payloads (signed in and logged out).
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { IconPhoto, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { checkUploadSize } from "@/lib/upload-limits";

export type PublicSponsor = {
  id: number;
  name: string;
  link: string | null;
  logo_url: string | null;
};

// Mirrors MAX_PUBLIC_SPONSORS on the backend, which refuses the add beyond it. Checked here too
// so the Add form disappears rather than letting somebody fill it in and be told no.
const MAX_PUBLIC_SPONSORS = 8;

export default function PublicSponsorsCard({
  eventId,
  initial,
}: {
  eventId: number | string;
  initial?: PublicSponsor[];
}) {
  const t = useTranslations("evEditTabs");
  const { token } = useAuth();

  const [sponsors, setSponsors] = useState<PublicSponsor[]>(initial ?? []);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // The parent hydrates asynchronously, so adopt the first real list that arrives. Guarded on
  // length: replacing state on every render of an empty array would wipe a just-added row.
  useEffect(() => {
    if (initial && initial.length) setSponsors(initial);
  }, [initial]);

  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/public-sponsors`;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const reset = () => {
    setName("");
    setLink("");
    setLogo(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const add = async () => {
    if (!name.trim()) {
      toast.error(t("publicSponsors.nameRequired"));
      return;
    }
    // Refuse an over-sized logo here, where the person can still pick another file. nginx would
    // otherwise reject the whole request with a response the browser cannot read - see
    // lib/upload-limits.ts for why that surfaces as an unexplainable failure.
    const tooBig = checkUploadSize(logo, t("publicSponsors.logo"));
    if (tooBig) {
      toast.error(tooBig);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("event_id", String(eventId));
      body.append("name", name.trim());
      if (link.trim()) body.append("link", link.trim());
      if (logo) body.append("logo", logo);
      const res = await axios.post(`${base}/add/`, body, auth);
      setSponsors(res.data.public_sponsors ?? []);
      reset();
      toast.success(t("publicSponsors.added"));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("publicSponsors.addFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try {
      const res = await axios.delete(`${base}/${id}/delete/`, auth);
      setSponsors(res.data.public_sponsors ?? sponsors.filter((s) => s.id !== id));
      toast.success(t("publicSponsors.removed"));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("publicSponsors.removeFailed"));
    } finally {
      setBusy(false);
    }
  };

  const full = sponsors.length >= MAX_PUBLIC_SPONSORS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("publicSponsors.title")}</CardTitle>
        <CardDescription>{t("publicSponsors.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {sponsors.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sponsors.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                {/* A plain <img>, not next/image: these are user-uploaded and served from the
                    API host, which is not in the next.config image allowlist. */}
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.logo_url}
                    alt={s.name}
                    className="size-10 shrink-0 rounded object-contain"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                    <IconPhoto className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  {s.link && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.link}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => remove(s.id)}
                  aria-label={t("publicSponsors.remove")}
                >
                  <IconTrash className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {full ? (
          <p className="text-xs text-muted-foreground">
            {t("publicSponsors.limitReached", { max: MAX_PUBLIC_SPONSORS })}
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ps-name">{t("publicSponsors.name")}</Label>
                <Input
                  id="ps-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("publicSponsors.namePlaceholder")}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-link">{t("publicSponsors.link")}</Label>
                <Input
                  id="ps-link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com"
                  inputMode="url"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-logo">{t("publicSponsors.logo")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  id="ps-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <IconUpload className="size-4" />
                  {t("publicSponsors.chooseLogo")}
                </Button>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {logo ? logo.name : t("publicSponsors.noLogoChosen")}
                </span>
              </div>
            </div>

            <Button type="button" onClick={add} disabled={busy}>
              {busy ? <Loader text={t("publicSponsors.adding")} /> : (
                <>
                  <IconPlus className="size-4" />
                  {t("publicSponsors.add")}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
