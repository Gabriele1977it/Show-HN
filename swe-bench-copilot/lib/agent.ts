// lib/agent.ts
// Phase 1: Real AI integration.
// Fetches the GitHub issue, asks Claude to write the fix as a unified diff,
// and saves the result (or the failure reason) back to the tasks table.

import Anthropic from '@anthropic-ai/sdk';
import { completeTask, failTask } from './db';

// Reads ANTHROPIC_API_KEY from .env.local automatically — no key in code.
const anthropic = new Anthropic();

// The model must reply in exactly this JSON shape (enforced by the API),
// so we never have to worry about parsing free-form text.
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    agent_diff: {
      type: 'string',
      description:
        'A unified git diff (diff --git format) containing the smallest correct code change that resolves the issue.',
    },
    summary: {
      type: 'string',
      description:
        'One short paragraph explaining the fix and any assumptions made, written for the senior engineer who will review it.',
    },
    tests_passed: {
      type: 'integer',
      description:
        'Estimated number of existing tests this change keeps passing.',
    },
    tests_failed: {
      type: 'integer',
      description:
        'Estimated number of tests this change might break. 0 if none.',
    },
    code_quality: {
      type: 'string',
      enum: ['A+', 'A', 'B', 'C', 'D'],
      description: 'Self-assessed quality grade for the proposed change.',
    },
  },
  required: ['agent_diff', 'summary', 'tests_passed', 'tests_failed', 'code_quality'],
  additionalProperties: false,
};

function parseIssueUrl(issueUrl: string) {
  const match = issueUrl.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

async function fetchIssue(owner: string, repo: string, number: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'swe-bench-copilot',
  };
  // Optional: raises the GitHub rate limit and allows private repos.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub returned ${res.status} for ${owner}/${repo}#${number} — check the URL (and GITHUB_TOKEN for private repos).`
    );
  }
  return (await res.json()) as { title: string; body: string | null };
}

export async function runAgentWorkflow(taskId: string, issueUrl: string) {
  try {
    const parsed = parseIssueUrl(issueUrl);
    if (!parsed) {
      throw new Error(
        'The URL must look like https://github.com/owner/repo/issues/123'
      );
    }

    const issue = await fetchIssue(parsed.owner, parsed.repo, parsed.number);

    // Streaming keeps the connection alive for long responses; adaptive
    // thinking lets the model reason before writing the diff.
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      system:
        'You are the autonomous software engineer inside "SWE-Bench Copilot". ' +
        'You are given a GitHub issue. Produce the smallest correct code change ' +
        'that resolves it, as a unified git diff, plus an honest self-assessment. ' +
        'You cannot see the full repository, so infer sensible file paths from ' +
        'the issue text and clearly state every assumption in the summary.',
      output_config: {
        format: { type: 'json_schema', schema: RESULT_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content:
            `Repository: ${parsed.owner}/${parsed.repo}\n` +
            `Issue #${parsed.number}: ${issue.title}\n\n` +
            `${issue.body ?? '(no description provided)'}`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error('The AI declined to work on this issue.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('The AI response was cut off — the issue may be too large.');
    }

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const result = JSON.parse(textBlock?.text ?? '{}');

    await completeTask(taskId, {
      agent_diff: `${result.agent_diff}\n\n--- Agent notes ---\n${result.summary}`,
      tests_passed: result.tests_passed,
      tests_failed: result.tests_failed,
      code_quality: result.code_quality,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    await failTask(taskId, reason);
  }
}
