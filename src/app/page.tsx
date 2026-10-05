import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">Blackbulk Learning</h1>
      <p className="text-lg opacity-80">
        Turn your class materials into a personal tutor. Ask questions, get answers with
        page citations, and practice with flashcards and quizzes.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded bg-black px-5 py-2 text-white dark:bg-white dark:text-black"
        >
          Log in or sign up
        </Link>
        <Link href="/dashboard" className="rounded border border-gray-300 px-5 py-2">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}