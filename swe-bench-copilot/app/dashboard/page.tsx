import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  Bot,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { getTasks, type Task } from "@/lib/db";
import { ingestIssueAction } from "@/lib/actions";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const COLUMNS: { title: string; statuses: string[]; icon: React.ReactNode }[] = [
  {
    title: "In Progress",
    statuses: ["pending", "running"],
    icon: <Loader2 className="h-4 w-4 animate-spin text-amber-400" />,
  },
  {
    title: "Needs Review",
    statuses: ["review"],
    icon: <Eye className="h-4 w-4 text-indigo-400" />,
  },
  {
    title: "Approved",
    statuses: ["approved"],
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
  {
    title: "Rejected / Failed",
    statuses: ["rejected", "failed"],
    icon: <XCircle className="h-4 w-4 text-rose-400" />,
  },
];

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{task.project_name}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
          {task.evaluation_score.code_quality}
        </span>
      </div>
      <a
        href={task.issue_url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-500 hover:text-zinc-300"
      >
        {task.issue_url} <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span>
          ✓ {task.evaluation_score.tests_passed} / ✗{" "}
          {task.evaluation_score.tests_failed} tests
        </span>
        <Link
          href={`/admin/tasks/${task.id}`}
          className="text-indigo-400 hover:text-indigo-300"
        >
          View diff →
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const tasks = await getTasks();
  const anyRunning = tasks.some(
    (t) => t.status === "running" || t.status === "pending"
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <AutoRefresh active={anyRunning} />

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-indigo-400" />
          <Link href="/">SWE-Bench Copilot</Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-300">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm text-zinc-400 hover:text-white"
          >
            Ops queue
          </Link>
          <UserButton />
        </div>
      </header>

      {/* Ingest form */}
      <form
        action={ingestIssueAction}
        className="mt-8 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 sm:flex-row"
      >
        <input
          type="url"
          name="issue_url"
          required
          placeholder="https://github.com/owner/repo/issues/123"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-indigo-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Send to AI agent
        </button>
      </form>

      {/* Kanban board */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => col.statuses.includes(t.status));
          return (
            <section key={col.title}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                {col.icon}
                {col.title}
                <span className="text-zinc-600">({colTasks.length})</span>
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {colTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">
                    Nothing here yet
                  </p>
                ) : (
                  colTasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
