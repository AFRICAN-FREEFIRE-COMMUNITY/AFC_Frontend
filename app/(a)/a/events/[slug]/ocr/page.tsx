"use client";

import { use, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconUpload, IconCheck, IconTrash, IconRefresh } from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";

type Params = { slug: string };

interface OcrSession {
  session_id: string;
  status: string;
  created_at: string;
  image_url?: string;
  extracted_data?: any;
  committed: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
  processing: "bg-blue-900/20 text-blue-400 border-blue-800",
  ready: "bg-green-900/20 text-green-400 border-green-800",
  committed: "bg-purple-900/20 text-purple-400 border-purple-800",
  failed: "bg-red-900/20 text-red-400 border-red-800",
};

export default function OcrPage({ params }: { params: Promise<Params> }) {
  const { slug } = use(params);
  const { token } = useAuth();

  const [sessions, setSessions] = useState<OcrSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchNumber, setMatchNumber] = useState("");
  const [viewSession, setViewSession] = useState<OcrSession | null>(null);
  const [committing, setCommitting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-sessions/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSessions(res.data ?? []);
    } catch {
      toast.error("Failed to load OCR sessions.");
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (token) fetchSessions();
  }, [token]);

  const handleUpload = async () => {
    if (!selectedFile) { toast.error("Select an image first."); return; }
    setUploading(true);
    const form = new FormData();
    form.append("image", selectedFile);
    if (matchNumber) form.append("match_number", matchNumber);
    form.append("event_slug", slug);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-match-result/`,
        form,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } },
      );
      toast.success("Image uploaded — OCR processing started.");
      setSelectedFile(null);
      setMatchNumber("");
      fetchSessions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async (sessionId: string) => {
    setCommitting(sessionId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/commit/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Results committed.");
      fetchSessions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to commit.");
    } finally {
      setCommitting(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    setDeleting(sessionId);
    try {
      await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Session deleted.");
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/ocr-session/${sessionId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setViewSession(res.data);
    } catch {
      toast.error("Failed to load session details.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader back title="OCR Match Results" description={`Upload match result screenshots for ${slug}`} />
        <Button size="sm" variant="outline" onClick={fetchSessions} disabled={loadingSessions}>
          <IconRefresh className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Screenshot</CardTitle>
          <CardDescription>
            Upload a match result screenshot. The system will extract scores and player data automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Match Screenshot *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Match Number (optional)</Label>
              <Input
                placeholder="e.g. 1"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
            <IconUpload className="h-4 w-4 mr-1.5" />
            {uploading ? "Uploading..." : "Upload & Process"}
          </Button>
        </CardContent>
      </Card>

      {/* Sessions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OCR Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSessions ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    No OCR sessions yet. Upload a screenshot above.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell className="font-mono text-xs">
                      {session.session_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[session.status] ?? ""}`}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {session.created_at ? formatDate(session.created_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewSession(session.session_id)}
                        >
                          Review
                        </Button>
                        {!session.committed && session.status === "ready" && (
                          <Button
                            size="sm"
                            onClick={() => handleCommit(session.session_id)}
                            disabled={committing === session.session_id}
                          >
                            <IconCheck className="h-3.5 w-3.5 mr-1" />
                            {committing === session.session_id ? "Committing..." : "Commit"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting === session.session_id}
                          onClick={() => handleDelete(session.session_id)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!viewSession} onOpenChange={(o) => { if (!o) setViewSession(null); }}>
        {viewSession && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Session Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[viewSession.status] ?? ""}`}>
                  {viewSession.status}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{viewSession.session_id}</span>
              </div>
              {viewSession.image_url && (
                <img src={viewSession.image_url} alt="OCR screenshot" className="rounded-md border w-full" />
              )}
              {viewSession.extracted_data && (
                <div>
                  <p className="text-sm font-semibold mb-2">Extracted Data</p>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewSession.extracted_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewSession(null)}>Close</Button>
              {!viewSession.committed && viewSession.status === "ready" && (
                <Button
                  onClick={() => { handleCommit(viewSession.session_id); setViewSession(null); }}
                  disabled={committing === viewSession.session_id}
                >
                  <IconCheck className="h-4 w-4 mr-1.5" />
                  Commit Results
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
