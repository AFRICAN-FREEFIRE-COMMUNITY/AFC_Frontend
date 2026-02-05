import { Metadata } from "next";
import axios from "axios";
import { env } from "@/lib/env";
import ProductDetailPage from "../_components/ProductDetailPage";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const res = await axios.get(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/view-product-details/?product_id=${id}`,
    );
    const product = res.data.product;

    return {
      title: `${product.name} | African Freefire Community`,
      description: product.description.substring(0, 160), // Keep it under 160 chars
      openGraph: {
        title: product.name,
        description: product.description,
        images: [{ url: "/default-product-image.jpg" }], // Or product.image if available
      },
    };
  } catch (error) {
    return {
      title: "Product Not Found",
    };
  }
}

export default function Page() {
  return <ProductDetailPage />;
}
