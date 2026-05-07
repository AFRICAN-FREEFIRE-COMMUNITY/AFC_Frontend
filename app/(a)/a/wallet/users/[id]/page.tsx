import UserWalletClient from "../../_components/UserWalletClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

const UserWalletPage = async ({ params }: PageProps) => {
  const { id } = await params;
  return (
    <div>
      <UserWalletClient userId={id} />
    </div>
  );
};

export default UserWalletPage;
