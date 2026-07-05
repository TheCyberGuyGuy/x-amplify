import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/components/dashboard-view";
import { OnboardingModal } from "@/components/onboarding-modal";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string; u?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  // Deep link from a push notification: /dashboard?post=<tweetId>&u=<username>
  const { post, u } = await searchParams;
  const focusPost =
    post && /^\d+$/.test(post)
      ? { tweetId: post, username: (u ?? "").replace(/[^a-zA-Z0-9_]/g, "") }
      : null;

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
        <DashboardView focusPost={focusPost} />
      </main>
      {needsOnboarding && <OnboardingModal />}
    </>
  );
}
