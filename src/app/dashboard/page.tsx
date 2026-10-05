import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="space-y-4 p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Signed in as {user.email}</p>
      <p>Role: {profile?.role ?? "unknown"}</p>

      <form
        action={async () => {
          "use server";
          const supabase = await createClient();
          await supabase.auth.signOut();
          redirect("/login");
        }}
      >
        <button className="rounded border border-gray-300 px-3 py-1">
          Sign out
        </button>
      </form>
    </main>
  );
}