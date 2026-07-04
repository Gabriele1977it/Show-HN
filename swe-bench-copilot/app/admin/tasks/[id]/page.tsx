import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { getTask } from "@/lib/db";
import { updateStatusAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

// Next.js 16: dynamic route params must be awaited.
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const canDecide = task.status === "review";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to ops queue
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{task.project_name}</h1>
          <a
            href={task.issue_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            {task.issue_url} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-sm capitalize text-zinc-300">
          {task.status}
        </span>
      </header>

      {/* SWE-Bench scores */}
      <section className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <p className="text-3xl font-bold text-emerald-400">
            {task.evaluation_score.tests_passed}
          </p>
          <p className="mt-1 text-xs uppercase text-zinc-500">Tests passed</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <p className="text-3xl font-bold text-rose-400">
            {task.evaluation_score.tests_failed}
          </p>
          <p className="mt-1 text-xs uppercase text-zinc-500">Tests failed</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <p className="text-3xl font-bold text-indigo-400">
            {task.evaluation_score.code_quality}
          </p>
          <p className="mt-1 text-xs uppercase text-zinc-500">Code quality</p>
        </div>
      </section>

      {/* Diff */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">
          Proposed change
        </h2>
        <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
          {task.agent_diff}
        </pre>
      </section>

      {/* Approve / Reject */}
      {canDecide && (
        <section className="mt-8 flex gap-4">
          <form action={updateStatusAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value="approved" />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
          </form>
          <form action={updateStatusAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value="rejected" />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-rose-500"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
