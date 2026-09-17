/**
 * lib/accountDeletion.ts - the typed client for deleting an account and bringing it back.
 *
 * Owner 2026-09-14 (inbox #20): "users can delete their accounts, of course its to be soft
 * deleted, head admins should be able to restore it back and a new user will be able to use
 * some info from that account."
 *
 * Backed by backend afc_auth/views_account_deletion.py (rules in afc_auth/account_deletion.py):
 *   GET  /auth/delete-account/                              what stands in the way + needs_password
 *   POST /auth/delete-account/                              the person deletes their own account
 *   GET  /auth/admin/deleted-accounts/                      head admins: the list (paged, searchable)
 *   POST /auth/admin/deleted-accounts/<user_id>/restore/    head admins: put one back
 *
 * Consumed by app/(user)/profile/_components/DeleteAccountCard.tsx (the card on
 * /profile/security) and app/(a)/a/_components/DeletedAccountsAdminContent.tsx (the Deleted tab
 * on /a/teams). Every refusal carries a `code` the two screens translate (accountDeletion.json).
 */
import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

/** One thing the person must settle before the account can go. `code` is translated. */
export type DeletionBlocker = { code: string; message: string };

export type DeletionPreflight = {
  can_delete: boolean;
  blockers: DeletionBlocker[];
  /** False for an account that signed up through Google or Discord and never set a password. */
  needs_password: boolean;
  username: string;
};

/** serialize_deleted_account on the backend: the same shape in the list and the restore answer. */
export type DeletedAccountRow = {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  uid: string | null;
  discord_username: string | null;
  whatsapp_number: string;
  reason: string;
  deleted_at: string | null;
  self_service: boolean;
  restored_at: string | null;
  restored_by: string | null;
  /** Released values another account has taken since; a restore is refused while non-empty. */
  conflicts: string[];
};

export type DeletedAccountsPage = {
  results: DeletedAccountRow[];
  total_count: number;
  has_more: boolean;
  next_offset: number;
};

export async function getDeletionPreflight(): Promise<DeletionPreflight> {
  const res = await axios.get<DeletionPreflight>(`${BASE}/auth/delete-account/`, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function deleteMyAccount(body: {
  confirm_username: string;
  password?: string;
  reason?: string;
}): Promise<{ message: string; deleted_at: string }> {
  const res = await axios.post(`${BASE}/auth/delete-account/`, body, { headers: authHeaders() });
  return res.data;
}

export async function listDeletedAccounts(params: {
  q?: string;
  include_restored?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<DeletedAccountsPage> {
  const res = await axios.get<DeletedAccountsPage>(`${BASE}/auth/admin/deleted-accounts/`, {
    headers: authHeaders(),
    params: {
      q: params.q || undefined,
      include_restored: params.include_restored ? "1" : undefined,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  return res.data;
}

export async function restoreDeletedAccount(
  userId: number,
): Promise<{ message: string; account: DeletedAccountRow }> {
  const res = await axios.post(
    `${BASE}/auth/admin/deleted-accounts/${userId}/restore/`,
    {},
    { headers: authHeaders() },
  );
  return res.data;
}
