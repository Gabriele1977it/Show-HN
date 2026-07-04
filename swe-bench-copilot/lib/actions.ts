// lib/actions.ts
// Server Actions — now protected by Clerk auth and with input validation.
// The ingest action kicks off the real AI workflow in the background.

'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { createTask, updateTaskStatus } from './db';
import { runAgentWorkflow } from './agent';

const ALLOWED_STATUSES = ['pending', 'running', 'review', 'approved', 'rejected'];

export async function ingestIssueAction(formData: FormData) {
  // Server actions are public HTTP endpoints — always check auth inside them.
  const { userId } = await auth();
  if (!userId) return;

  const url = ((formData.get('issue_url') as string) || '').trim();
  if (!url) return;

  // Derive the project name from the URL instead of hardcoding 'Client Repo'.
  const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/issues\/\d+/);
  const projectName = match ? `${match[1]}/${match[2]}` : 'Client Repo';

  const task = await createTask(url, projectName);

  // Fire-and-forget: the AI works in the background while the dashboard
  // shows the task as 'running'. runAgentWorkflow handles its own errors
  // by marking the task 'failed'; this catch is a last-resort safety net.
  runAgentWorkflow(task.id, url).catch((err) => {
    console.error('Agent workflow crashed:', err);
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

export async function updateStatusAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) return;

  const taskId = formData.get('taskId') as string;
  const status = formData.get('status') as string;
  if (!taskId || !ALLOWED_STATUSES.includes(status)) return;

  await updateTaskStatus(taskId, status);
  revalidatePath('/admin');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/dashboard');
}
