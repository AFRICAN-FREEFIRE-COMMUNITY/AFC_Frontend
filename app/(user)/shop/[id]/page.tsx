import { Metadata } from "next";
import axios from "axios";
import { env } from "@/lib/env";
import ProductDetailPage from "../_components/ProductDetailPage";
// Shared link-embed builder (lib/seo.ts) — LARGE Twitter card + absolute URLs.
//   generateProductSchema    → JSON-LD Product (offers in NGN) for this product
//   generateBreadcrumbSchema → Home > Shop > <product> trail
//   jsonLd                   → render a schema object as a <script ld+json>
import {
  buildEntityMetadata,
  generateProductSchema,
  generateBreadcrumbSchema,
  resolveOgImage,
  siteConfig,
  jsonLd,
} from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
};

// Shared server-side fetch of a single product (public, no auth). Same endpoint
// generateMetadata uses, so Next de-dupes the call. Returns the product or null.
async function getProductData(id: string) {
  try {
    const res = await axios.get(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-product-details/?product_id=${id}`,
    );
    return res.data.product || null;
  } catch {
    return null;
  }
}

// Compute the cheapest active variant price (the "from $X" figure). Returns null
// when no usable price exists, so the schema omits the offer rather than faking 0.
function cheapestActivePrice(product: any): number | null {
  const prices = (product?.variants || [])
    .filter((v: any) => v.is_active !== false)
    .map((v: any) => parseFloat(v.price))
    .filter((n: number) => !Number.isNaN(n));
  return prices.length > 0 ? Math.min(...prices) : null;
}

// ── generateMetadata: rich link embed for a single shop product ──────────────
// Data source: GET /shop/view-product-details/?product_id=<id> (public, no auth)
// — the same endpoint ProductDetailPage reads. Response shape:
//   { product: { id, name, description, image (absolute), variants: [{ price, ... }] } }.
// The embed shows the product name + starting price and uses the product's real
// primary image (already an absolute URL from the backend's _abs_url). Falls back
// to site-default metadata when the product is missing — never throws.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await getProductData(id);
    if (!product) throw new Error("product not found");

    // Starting price = the cheapest active variant price (the "from $X" figure the
    // detail page itself shows). Variant.price is a stringified decimal.
    const startingPrice = cheapestActivePrice(product);

    // Strip any HTML from the stored description, then prepend the price line.
    const plainDesc = (product.description || "")
      .replace(/<[^>]*>/g, "")
      .trim();
    const priceLine =
      startingPrice != null ? `From $${startingPrice.toLocaleString()}. ` : "";
    const description =
      `${priceLine}${plainDesc || `Buy ${product.name} on the African Freefire Community shop.`}`.slice(
        0,
        180,
      );

    return buildEntityMetadata({
      title: product.name,
      description,
      path: `/shop/${id}`,
      image: product.image || null, // real primary image (absolute) or site default
      tags: [product.name, "AFC shop", "Free Fire merch"].filter(Boolean),
    });
  } catch (error) {
    return buildEntityMetadata({
      title: "AFC Shop",
      description:
        "Browse official African Freefire Community merchandise and rewards.",
      path: `/shop/${id}`,
    });
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;

  // Re-use the cached product fetch to embed JSON-LD in the INITIAL HTML. The
  // interactive product UI still renders inside <ProductDetailPage> (client).
  const product = await getProductData(id);

  let productSchema: object | null = null;
  let breadcrumbSchema: object | null = null;
  if (product) {
    const path = `/shop/${id}`;
    const plainDesc = (product.description || "").replace(/<[^>]*>/g, "").trim();
    // Whether any active variant is actually purchasable right now.
    const inStock = (product.variants || []).some(
      (v: any) => v.is_active !== false && v.in_stock !== false,
    );
    productSchema = generateProductSchema({
      name: product.name,
      url: `${siteConfig.url}${path}`,
      image: product.image ? resolveOgImage(product.image) : null,
      description: plainDesc || null,
      price: cheapestActivePrice(product),
      currency: "NGN", // AFC shop charges in Naira via Paystack
      inStock,
    });
    breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      { name: product.name, path },
    ]);
  }

  return (
    <>
      {productSchema && <script {...jsonLd(productSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      <ProductDetailPage />
    </>
  );
}
