import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Bot } from "lucide-react";
import { getTasks } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-zinc-800 text-zinc-300",
  running: "bg-amber-500/15 text-amber-300",
  review: "bg-indigo-500/15 text-indigo-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  failed: "bg-rose-500/15 text-rose-300",
};

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const tasks = await getTasks();
  const anyRunning = tasks.some(
    (t) => t.status === "running" || t.status === "pending"
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <AutoRefresh active={anyRunning} />

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-indigo-400" />
          <Link href="/">SWE-Bench Copilot</Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-300">Ops queue</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white"
          >
            Dashboard
          </Link>
          <UserButton />
        </div>
      </header>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tests</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                  No tasks yet — submit an issue from the dashboard.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3 font-medium">{task.project_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[task.status] ?? STATUS_STYLES.pending
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    ✓ {task.evaluation_score.tests_passed} / ✗{" "}
                    {task.evaluation_score.tests_failed}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {task.evaluation_score.code_quality}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/tasks/${task.id}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
