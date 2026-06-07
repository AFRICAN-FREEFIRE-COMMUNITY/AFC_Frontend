"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Search, Calendar as CalendarIcon } from "lucide-react";

// ── Action-description rendering ─────────────────────────────────────────────
// Some audit rows (e.g. event edits) store the action as a raw JSON blob like
//   { "event_id": 163, "changes": ["is_public: 'True' -> 'False'"] }
// instead of plain English. renderDescription() detects those rows and turns
// them into readable text. Consumed only by the Action column below
// (activity.description, fetched from GET /auth/get-admin-history/).

// A single change entry can arrive either as a pre-formatted string
// ("is_public: 'True' -> 'False'") or as a structured object
// ({ field, old, new }). normalizeChange() flattens both into one line and
// strips the surrounding quotes the backend wraps values in.
const normalizeChange = (change: any): string => {
  if (typeof change === "string") {
    // Drop the single quotes the backend adds around values so it reads as
    // "is_public: True -> False" instead of "is_public: 'True' -> 'False'".
    return change.replace(/'/g, "");
  }
  if (change && typeof change === "object") {
    const field = change.field ?? change.name ?? "field";
    const oldVal = change.old ?? change.from ?? change.previous;
    const newVal = change.new ?? change.to ?? change.current;
    if (oldVal !== undefined || newVal !== undefined) {
      return `${field}: ${oldVal} -> ${newVal}`;
    }
    return field;
  }
  return String(change);
};

// Builds a short headline for an object-shaped action, e.g.
// "Edited event #163" from { event_id: 163, ... }. Falls back to a generic
// label when no recognizable id field is present.
const buildHeadline = (data: any): string => {
  if (data.event_id !== undefined) return `Edited event #${data.event_id}`;
  if (data.match_id !== undefined) return `Edited match #${data.match_id}`;
  if (data.team_id !== undefined) return `Edited team #${data.team_id}`;
  if (data.product_id !== undefined) return `Edited product #${data.product_id}`;
  if (data.id !== undefined) return `Edited record #${data.id}`;
  return "Updated record";
};

// Turns a raw description into JSX. If it is a JSON object/array, render a
// readable summary (headline + bulleted changes); otherwise render the string
// unchanged. Any parse failure falls back to the raw string so we never hide
// data from the admin.
const renderDescription = (description: string) => {
  const trimmed = (description ?? "").trim();

  // Only attempt JSON parsing when it actually looks like JSON.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);

      // Pull the changes list out of either the object or a bare array.
      const changes: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.changes)
          ? data.changes
          : [];

      const lines = changes.map(normalizeChange).filter(Boolean);

      // Object with an id and a single change: render the compact one-liner
      // ("Edited event #163: is_public True -> False").
      if (!Array.isArray(data) && lines.length === 1) {
        return `${buildHeadline(data)}: ${lines[0]}`;
      }

      // Object/array with multiple changes: headline plus a bulleted list.
      if (lines.length > 0) {
        const headline = Array.isArray(data) ? null : buildHeadline(data);
        return (
          <div className="flex flex-col gap-0.5">
            {headline && <span className="font-medium">{headline}</span>}
            <ul className="list-disc list-inside text-muted-foreground">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        );
      }

      // Parsed JSON but found no changes to summarize: show the headline alone
      // for objects, otherwise fall through to the raw string.
      if (!Array.isArray(data)) {
        return buildHeadline(data);
      }
    } catch {
      // Not valid JSON after all: fall through and render the raw string.
    }
  }

  return description;
};

const Page = () => {
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);

  // States for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const activities = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-admin-history/`,
        );
        setRecentActivities(activities?.data?.admin_history || []);
      } catch (error) {
        toast.error("Oops! An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filtering Logic
  const filteredActivities = useMemo(() => {
    return recentActivities.filter((activity: any) => {
      // 1. Search filter (checks admin name or description)
      const matchesSearch =
        activity.admin_user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Date filter
      // Note: This assumes activity.timestamp is a valid date string
      const matchesDate = dateFilter
        ? activity.timestamp.startsWith(dateFilter)
        : true;

      return matchesSearch && matchesDate;
    });
  }, [recentActivities, searchQuery, dateFilter]);

  if (loading) {
    return <FullLoader />;
  }

  return (
    <div>
      <PageHeader title="History" back />

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by admin or action..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="relative w-full md:w-72">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            className="pl-10 w-full"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admin User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="text-right">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredActivities.length > 0 ? (
            filteredActivities.map((activity: any) => (
              <TableRow key={activity.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  {activity.admin_user}
                </TableCell>
                <TableCell className="max-w-sm overflow-x-hidden">
                  {/* Renders plain strings as-is; JSON blobs become a readable
                      summary via renderDescription() defined above. */}
                  {renderDescription(activity.description)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                  {formatDate(activity.timestamp)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-24 text-center text-muted-foreground italic"
              >
                No matching history found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default Page;
