import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm
        initialError={
          error
            ? "Sign-in did not complete. If you just confirmed your email, try logging in."
            : ""
        }
      />
    </main>
  );
}