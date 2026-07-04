"use client";

// While any task is 'running', silently reload the server data every 5s
// so the board updates when the AI finishes — no manual refresh needed.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
