import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { AdminView } from "@/components/admin-view";
import { isAdmin } from "@/lib/roles";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  return (
    <>
      <SiteHeader
        name={session.user.name}
        username={session.user.username}
        image={session.user.image}
        role={session.user.role}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <AdminView
          isSuperAdmin={session.user.role === "SUPER_ADMIN"}
          currentUsername={session.user.username}
        />
      </main>
    </>
  );
}
