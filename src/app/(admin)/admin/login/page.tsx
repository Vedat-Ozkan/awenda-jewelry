import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  notallowed: "That account isn't allowed to sign in here.",
  "1": "That link didn't work. Request a new one below.",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const errorParam = params.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-page px-4 py-10 font-sans text-ink">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-[0_1px_0_rgba(30,31,36,0.07)] sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Awenda Admin</p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">Admin sign-in</h1>
        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {ERROR_MESSAGES[error] ?? "Something went wrong."}
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
