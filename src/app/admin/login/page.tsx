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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">Admin sign-in</h1>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
