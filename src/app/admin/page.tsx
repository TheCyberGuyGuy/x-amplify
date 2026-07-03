import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { AdminView } from "@/components/admin-view";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <>
      <SiteHeader
        name={session.user.name}
        username={session.user.username}
        image={session.user.image}
        role={session.user.role}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <AdminView />
      </main>
    </>
  );
}
