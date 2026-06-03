import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import Logo from "@/components/shared/Logo";

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 border-b border-black/[0.06] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="dark" size="sm" />
          <span className="hidden sm:inline text-[14px] text-accent-ink/55 ml-1">
            Portal
          </span>
        </Link>
        <p className="text-[13px] text-accent-ink/55">
          Already have an account?{" "}
          <Link
            href="/portal/sign-in"
            className="text-accent-emerald hover:underline"
          >
            Sign in
          </Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full max-w-[420px]",
              card: "shadow-[0_20px_60px_-20px_rgba(10,31,27,0.15)] border border-black/[0.06]",
              headerTitle: "font-display tracking-[-0.01em]",
              formButtonPrimary:
                "bg-accent-ink hover:bg-accent-ink/90 text-white normal-case font-medium rounded-full",
              footerActionLink:
                "text-accent-emerald hover:text-accent-emerald/80",
            },
          }}
        />
      </main>
    </div>
  );
}
