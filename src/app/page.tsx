import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";
import { XLogo } from "@/components/icons";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-8 flex items-center justify-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)] text-2xl font-black text-[var(--brand-contrast)]">
            e
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black">
            <XLogo className="h-6 w-6" />
          </span>
        </div>

        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Connect with your{" "}
          <span className="text-[var(--brand)]">eToro</span> colleagues on X
        </h1>
        <p className="mx-auto mt-5 max-w-md text-balance text-lg text-[var(--muted)]">
          Sign in with X to instantly see which teammates you already follow —
          and follow the rest in one click. Stronger together, louder together.
        </p>

        <div className="mt-10 flex justify-center">
          <SignInButton />
        </div>

        <p className="mt-6 text-xs text-[var(--muted)]/70">
          We only request read access to your X profile. Follows happen on X,
          confirmed by you.
        </p>
      </div>
    </main>
  );
}
