"use client";

// ── Admin · Polls (/a/polls) ─────────────────────────────────────────────────
// Every poll this manager may see, drafts included, plus the awards editions that group
// award ballots into a season. Replaces /a/votes, which redirects here (next.config.ts).
//
// WHO SEES WHAT. The backend gate is afc_polls.permissions.can_manage_poll, which is the
// EXISTING event-admin gate composed with the existing organizer gate, not a new
// permission. So an AFC admin sees every poll; an organizer sees the polls on the events
// they can already edit. This page does not re-derive that: it renders whatever
// GET /polls/admin/polls/ returns, because a client that computed its own permission
// would eventually disagree with the server that enforces it.
//
// The Editions tab is AFC-staff only on the backend (an edition spans several polls and is
// a site-wide object), and the tab is hidden for anybody the create call would refuse, so
// nobody is shown a form that cannot succeed.
//
// Mirrors the admin Partners list idiom (app/(a)/a/partners/page.tsx): PageHeader, a
// shadcn Table, a create Dialog, tabs as pill segments. Route protection comes from
// app/(a)/a/layout.tsx, which wraps every admin route in <ProtectedRoute adminOnly>.
//
// TALKS TO lib/polls.ts -> backend afc_polls/views.py (admin_polls, admin_editions).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconAward, IconChartBar, IconPlus } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { pollsApi, type AwardsEdition, type PollCard } from "@/lib/polls";

export default function AdminPollsPage() {
  const t = useTranslations("adminPolls");
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [polls, setPolls] = useState<PollCard[]>([]);
  const [editions, setEditions] = useState<AwardsEdition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pollData, editionData] = await Promise.all([
        pollsApi.adminList({ limit: 100 }),
        // An organizer is refused this one by the backend, which is correct and not an error
        // worth a toast: they simply have no editions tab.
        pollsApi.adminListEditions().catch(() => ({ results: [] as AwardsEdition[] })),
      ]);
      setPolls(pollData.results || []);
      setEditions(editionData.results || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <FullLoader />;

  return (
    <div className="py-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")}
            <NewBadge since="2026-08-16" />
          </span>
        }
        description={t("subtitle")}
      />

      <Tabs defaultValue="polls" className="mt-6 w-full">
        <TabsList className="h-9 bg-muted">
          <TabsTrigger value="polls">{t("tabs.polls")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="editions">{t("tabs.editions")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="polls" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <CreatePollDialog editions={editions} onCreated={(slug) => router.push(`/a/polls/${slug}`)} />
          </div>
          <PollTable polls={polls} emptyText={t("empty.polls")} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="editions" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <CreateEditionDialog onCreated={load} />
            </div>
            <EditionTable editions={editions} emptyText={t("empty.editions")} onChanged={load} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PollTable({ polls, emptyText }: { polls: PollCard[]; emptyText: string }) {
  const t = useTranslations("adminPolls");
  if (polls.length === 0) {
    return (
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }
  return (
    // Tables scroll INSIDE their container rather than overflowing the page, which is the
    // difference between a usable and an unusable admin list at 390px.
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="h-10">
            <TableHead className="p-2 text-xs text-foreground">{t("table.poll")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.kind")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.state")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.responses")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.closes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {polls.map((poll) => (
            <TableRow key={poll.slug}>
              <TableCell className="p-2 text-xs">
                <Link href={`/a/polls/${poll.slug}`} className="font-medium text-primary hover:underline">
                  {poll.title}
                </Link>
                {poll.awards_edition && (
                  <span className="block text-muted-foreground">{poll.awards_edition}</span>
                )}
              </TableCell>
              <TableCell className="p-2 text-xs">
                <span className="flex items-center gap-1">
                  {poll.kind === "award" ? (
                    <IconAward className="h-3.5 w-3.5 text-gold" />
                  ) : (
                    <IconChartBar className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {t(`kind.${poll.kind}`)}
                </span>
              </TableCell>
              <TableCell className="p-2 text-xs">
                <Badge
                  variant="outline"
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    poll.visibility === "public" ? "border-primary/50 text-primary" : ""
                  }`}
                >
                  {t(`visibility.${poll.visibility || "draft"}`)}
                </Badge>
              </TableCell>
              <TableCell className="p-2 text-xs tabular-nums">{poll.response_count ?? 0}</TableCell>
              <TableCell className="p-2 text-xs">
                {poll.closes_at ? <LocalTime value={poll.closes_at} mode="date" /> : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CreatePollDialog({
  editions,
  onCreated,
}: {
  editions: AwardsEdition[];
  onCreated: (slug: string) => void;
}) {
  const t = useTranslations("adminPolls");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"standard" | "award">("standard");
  const [subject, setSubject] = useState<"individual" | "team">("individual");
  const [editionSlug, setEditionSlug] = useState("");

  const create = async () => {
    if (!title.trim()) {
      toast.error(t("create.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const { slug } = await pollsApi.adminCreate({
        title: title.trim(),
        kind,
        subject,
        edition_slug: kind === "award" ? editionSlug : "",
      });
      toast.success(t("create.created"));
      setOpen(false);
      onCreated(slug);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("create.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t("create.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.heading")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="poll-title">{t("fields.title")}</Label>
            <Input id="poll-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("fields.kind")}</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("kind.standard")}</SelectItem>
                <SelectItem value="award">{t("kind.award")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("fields.subject")}</Label>
            <Select value={subject} onValueChange={(value) => setSubject(value as typeof subject)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t("subject.individual")}</SelectItem>
                <SelectItem value="team">{t("subject.team")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("fields.subjectHint")}</p>
          </div>
          {kind === "award" && (
            <div className="space-y-1.5">
              <Label>{t("fields.edition")}</Label>
              <Select value={editionSlug || "none"} onValueChange={(v) => setEditionSlug(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("fields.noEdition")}</SelectItem>
                  {editions.map((edition) => (
                    <SelectItem key={edition.slug} value={edition.slug}>
                      {edition.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? t("create.saving") : t("create.button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditionTable({
  editions,
  emptyText,
  onChanged,
}: {
  editions: AwardsEdition[];
  emptyText: string;
  onChanged: () => void;
}) {
  const t = useTranslations("adminPolls");
  if (editions.length === 0) {
    return (
      <Card className="bg-card rounded-md border py-6 shadow-sm">
        <CardContent className="text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="h-10">
            <TableHead className="p-2 text-xs text-foreground">{t("table.edition")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.phase")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.ballots")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground">{t("table.announced")}</TableHead>
            <TableHead className="p-2 text-xs text-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {editions.map((edition) => (
            <TableRow key={edition.slug}>
              <TableCell className="p-2 text-xs">
                <Link href={`/awards/${edition.slug}`} className="font-medium text-primary hover:underline">
                  {edition.title}
                </Link>
              </TableCell>
              <TableCell className="p-2 text-xs">
                {/* Derived from the dates on every read, never stored, so it can never disagree
                    with the ballot underneath it. */}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {t(`phase.${edition.phase}`)}
                </Badge>
              </TableCell>
              <TableCell className="p-2 text-xs tabular-nums">{edition.poll_count}</TableCell>
              <TableCell className="p-2 text-xs">
                {edition.winners_announced_at ? (
                  <LocalTime value={edition.winners_announced_at} mode="date" />
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="p-2 text-right text-xs">
                <EditEditionDialog edition={edition} onSaved={onChanged} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The four moments of an awards season. They are four datetimes and not a status dropdown
 *  because a stored status plus a set of dates drift apart the first time somebody edits one
 *  without the other, and then the countdown says "voting opens in 3 days" over a live ballot. */
const EDITION_DATES = [
  "nominations_close",
  "voting_opens_at",
  "voting_closes_at",
  "winners_announced_at",
] as const;

function EditionForm({
  form,
  setForm,
}: {
  form: Record<string, any>;
  setForm: (next: Record<string, any>) => void;
}) {
  const t = useTranslations("adminPolls");
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("fields.title")}</Label>
        <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("fields.year")}</Label>
          <Input
            type="number"
            value={form.year || ""}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("fields.order")}</Label>
          <Input
            type="number"
            value={form.order ?? 0}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("fields.tagline")}</Label>
        <Input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </div>
      {EDITION_DATES.map((field) => (
        <div key={field} className="space-y-1.5">
          <Label>{t(`fields.${field}`)}</Label>
          <Input
            type="datetime-local"
            value={toLocalInput(form[field])}
            onChange={(e) => setForm({ ...form, [field]: fromLocalInput(e.target.value) })}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("fields.datesHint")}</p>
    </div>
  );
}

function CreateEditionDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("adminPolls");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ title: "", order: 0 });

  const create = async () => {
    if (!form.title?.trim()) {
      toast.error(t("create.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      await pollsApi.adminCreateEdition(form);
      toast.success(t("create.editionCreated"));
      setOpen(false);
      setForm({ title: "", order: 0 });
      onCreated();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("create.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t("create.editionButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.editionHeading")}</DialogTitle>
        </DialogHeader>
        <EditionForm form={form} setForm={setForm} />
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? t("create.saving") : t("create.editionButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEditionDialog({ edition, onSaved }: { edition: AwardsEdition; onSaved: () => void }) {
  const t = useTranslations("adminPolls");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...edition });

  const save = async () => {
    setSaving(true);
    try {
      await pollsApi.adminUpdateEdition(edition.slug, form);
      toast.success(t("edit.saved"));
      setOpen(false);
      onSaved();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("edit.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("edit.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edition.title}</DialogTitle>
        </DialogHeader>
        <EditionForm form={form} setForm={setForm} />
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? t("create.saving") : t("edit.button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── datetime-local <-> ISO ───────────────────────────────────────────────────
// The backend is UTC and <input type="datetime-local"> is local-with-no-zone, so the two
// have to be converted rather than passed through. Everything a VIEWER reads goes through
// LocalTime instead; these two exist only for the admin form, where somebody is typing a
// wall-clock time in their own zone and expects it back unchanged.

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
