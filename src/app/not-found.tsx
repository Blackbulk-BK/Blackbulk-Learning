import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="opacity-70">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="underline">
        Back to dashboard
      </Link>
    </main>
  );
}