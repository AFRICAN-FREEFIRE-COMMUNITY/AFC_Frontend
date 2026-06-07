import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Shop category client.
//
// Purpose:
//   Thin typed helpers for the admin-managed product categories that generalise
//   the shop past diamonds. They back:
//     - the user shop tabs            (view-active-categories, public)
//     - the admin "Manage Categories" CRUD surface (view-all-categories + CRUD)
//     - the category <Select> in the Add/Edit Product forms
//
// How it connects:
//   - Backend endpoints live under /shop/ in afc_shop/urls.py:
//       GET  view-all-categories     (admin, full list + product_count)
//       GET  view-active-categories  (public, drives shop tabs)
//       POST create-category / edit-category / delete-category (admin)
//   - Auth mirrors lib/organizers.ts: the Bearer token is read from the same
//     `auth_token` cookie AuthContext writes, so callers need not thread it.
//   - Errors surface as axios errors (err.response.data.message) handled with a
//     sonner toast at the call site, like the rest of the shop.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// Admin-facing category (includes inactive state + usage count).
export interface ShopCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_physical: boolean;
  is_active: boolean;
  ordering: number;
  product_count: number;
  created_at?: string;
  updated_at?: string;
}

// Public-facing category (subset returned by view-active-categories).
export interface ShopCategoryLite {
  id: number;
  name: string;
  slug: string;
  is_physical: boolean;
  is_active: boolean;
}

// Fields the create/edit forms submit.
export interface ShopCategoryInput {
  name: string;
  description?: string;
  is_physical: boolean;
  is_active: boolean;
  ordering?: number;
}

// Admin: full category list with product counts (for the management table).
export async function fetchAllCategories(): Promise<ShopCategory[]> {
  const res = await axios.get(`${BASE}/shop/view-all-categories/`, {
    headers: authHeaders(),
  });
  return res.data.categories ?? [];
}

// Public: active categories for tabs / product form Select.
export async function fetchActiveCategories(): Promise<ShopCategoryLite[]> {
  const res = await axios.get(`${BASE}/shop/view-active-categories/`);
  return res.data.categories ?? [];
}

export async function createCategory(input: ShopCategoryInput) {
  const res = await axios.post(`${BASE}/shop/create-category/`, input, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function editCategory(
  categoryId: number,
  input: Partial<ShopCategoryInput>,
) {
  const res = await axios.post(
    `${BASE}/shop/edit-category/`,
    { category_id: categoryId, ...input },
    { headers: authHeaders() },
  );
  return res.data;
}

export async function deleteCategory(categoryId: number) {
  const res = await axios.post(
    `${BASE}/shop/delete-category/`,
    { category_id: categoryId },
    { headers: authHeaders() },
  );
  return res.data;
}
