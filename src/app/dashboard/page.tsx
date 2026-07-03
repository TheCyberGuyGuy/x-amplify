import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/components/dashboard-view";
import { OnboardingModal } from "@/components/onboarding-modal";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  // New users self-register with no type yet → prompt them to choose.
  let needsOnboarding = false;
  if (session.user.username) {
    const own = await prisma.poolHandle.findUnique({
      where: { username: session.user.username.toLowerCase() },
      select: { type: true },
    });
    needsOnboarding = !own?.type;
  }

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
      {needsOnboarding && <OnboardingModal />}
    </>
  );
}
