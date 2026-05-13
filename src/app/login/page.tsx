import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ session?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const sessionRequired = sp.session === "required";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center px-4 py-10">
      <div className="grid w-full gap-8 md:grid-cols-[1fr_460px] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cedar">Qaffel V0</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-ink md:text-5xl">Keep the invoice trail clean.</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-700">
            Sign in to create clients, send public invoice pages, collect screenshots, and export records for your accountant.
          </p>
        </div>
        <div>
          {sessionRequired ? (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <p className="font-semibold">Sign in to continue</p>
              <p className="mt-1 text-xs text-sky-900/90">Your session may have expired, or this page requires an account.</p>
            </div>
          ) : null}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
