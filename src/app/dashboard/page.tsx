import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/components/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <>
      <SiteHeader
        name={session.user.name}
        username={session.user.username}
        image={session.user.image}
        role={session.user.role}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <DashboardView />
      </main>
    </>
  );
}
