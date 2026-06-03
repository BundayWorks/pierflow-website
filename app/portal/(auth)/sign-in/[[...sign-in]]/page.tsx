import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-[420px]",
            card: "shadow-[0_20px_60px_-20px_rgba(10,31,27,0.15)] border border-black/[0.06]",
            headerTitle: "font-display tracking-[-0.01em]",
            formButtonPrimary:
              "bg-accent-ink hover:bg-accent-ink/90 text-white normal-case font-medium rounded-full",
            footerActionLink: "text-accent-emerald hover:text-accent-emerald/80",
          },
        }}
      />
    </div>
  );
}
