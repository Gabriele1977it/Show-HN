// lib/db.ts
// Database layer only — no AI logic in here anymore.
// The mock setTimeout workflow has been removed; lib/agent.ts does the real work.

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // NOTE: this skips certificate verification. It works, but for production
  // download Aiven's ca.pem and use ssl: { ca: fs.readFileSync('ca.pem').toString() }
  ssl: { rejectUnauthorized: false },
  max: 5, // Aiven free/hobby tiers have low connection limits
});

export type Task = {
  id: string;
  issue_url: string;
  status: string;
  agent_diff: string;
  evaluation_score: {
    tests_passed: number;
    tests_failed: number;
    code_quality: string;
  };
  project_name: string;
  created_at: string;
};

const formatTask = (data: any): Task => ({
  ...data,
  evaluation_score: {
    tests_passed: data.tests_passed || 0,
    tests_failed: data.tests_failed || 0,
    code_quality: data.code_quality || 'Pending',
  },
});

export async function getTasks() {
  const { rows } = await pool.query(
    'SELECT * FROM tasks ORDER BY created_at DESC'
  );
  return rows.map(formatTask);
}

export async function getTask(id: string) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] ? formatTask(rows[0]) : null;
}

export async function createTask(issue_url: string, project_name: string) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (issue_url, status, agent_diff, project_name, code_quality)
     VALUES ($1, 'running', 'Agent is analyzing the issue...', $2, 'Pending')
     RETURNING *`,
    [issue_url, project_name]
  );
  return formatTask(rows[0]);
}

export async function completeTask(
  id: string,
  result: {
    agent_diff: string;
    tests_passed: number;
    tests_failed: number;
    code_quality: string;
  }
) {
  await pool.query(
    `UPDATE tasks
     SET status = 'review', agent_diff = $1, tests_passed = $2,
         tests_failed = $3, code_quality = $4
     WHERE id = $5`,
    [result.agent_diff, result.tests_passed, result.tests_failed, result.code_quality, id]
  );
}

export async function failTask(id: string, errorMessage: string) {
  await pool.query(
    `UPDATE tasks
     SET status = 'failed', code_quality = 'N/A', agent_diff = $1
     WHERE id = $2`,
    [`The agent could not complete this task.\n\nReason: ${errorMessage}`, id]
  );
}

export async function updateTaskStatus(id: string, status: string) {
  const { rows } = await pool.query(
    'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] ? formatTask(rows[0]) : null;
}
