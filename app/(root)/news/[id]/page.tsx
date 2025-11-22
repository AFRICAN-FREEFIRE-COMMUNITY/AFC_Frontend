import Layout from "@/components/Layout";
import { NewsDetails } from "./_components/NewsDetails";

type Params = Promise<{
  id: string;
}>;

export default async function NewsPostPage({ params }: { params: Params }) {
  const { id } = await params;

  return (
    <Layout>
      <NewsDetails id={id} />
    </Layout>
  );
}
