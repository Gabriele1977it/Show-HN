import Link from "next/link";
import {
  Bot,
  GitPullRequest,
  ShieldCheck,
  Gauge,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-indigo-400" />
          <span>SWE-Bench Copilot</span>
          <span className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
            by MadlabsUk
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
          Your GitHub issues,{" "}
          <span className="text-indigo-400">fixed by AI</span>.
          <br />
          Reviewed by your seniors.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Paste a GitHub issue. An AI agent writes the code, scores its own
          work against SWE-Bench criteria, and drops the diff into an action
          queue for your senior engineers to approve or reject.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-3 font-medium text-white hover:bg-indigo-400"
          >
            Open the dashboard <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-sm text-zinc-500">$49/mo per team</span>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <GitPullRequest className="h-8 w-8 text-indigo-400" />
          <h3 className="mt-4 font-semibold">Issue in, diff out</h3>
          <p className="mt-2 text-sm text-zinc-400">
            The agent reads the real issue from GitHub and produces a unified
            diff with its reasoning attached.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <Gauge className="h-8 w-8 text-indigo-400" />
          <h3 className="mt-4 font-semibold">SWE-Bench scoring</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Every task carries test estimates and a code-quality grade, so
            reviewers know where to look first.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <ShieldCheck className="h-8 w-8 text-indigo-400" />
          <h3 className="mt-4 font-semibold">Humans stay in charge</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Nothing ships without a senior engineer pressing Approve. AI does
            the typing, your team does the judging.
          </p>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} MadlabsUk — SWE-Bench Copilot
      </footer>
    </main>
  );
}
