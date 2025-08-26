import Layout from "@/components/Layout";
import { TeamDetails } from "./_components/TeamDetails";

type Params = Promise<{
  id: string;
}>;

export default async function TeamProfilePage({ params }: { params: Params }) {
  const { id } = await params;

  return (
    <Layout>
      <TeamDetails id={id} />
    </Layout>
  );
}
