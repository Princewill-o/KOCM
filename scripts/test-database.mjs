import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Intentionally never accept a connection URL/database name or inherit PGHOST/PGSERVICE.
// All SQL runs in a fresh randomly named LOCAL database, which is dropped afterwards.
const root = fileURLToPath(new URL('../', import.meta.url));
const database = `koc_workflow_test_${randomUUID().replaceAll('-', '')}`;
const host = process.env.KOC_TEST_PGHOST ?? '127.0.0.1';
const port = process.env.KOC_TEST_PGPORT ?? '5432';
if (!['127.0.0.1', 'localhost', '::1', '/tmp', '/var/run/postgresql'].includes(host)) throw new Error('Database tests require a local PostgreSQL host.');
if (!/^\d{1,5}$/.test(port) || +port > 65535 || +port < 1) throw new Error('Invalid local PostgreSQL port.');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
// A CI-local password is optional; never print it or include it in command arguments.
if (process.env.KOC_TEST_PGPASSWORD) env.PGPASSWORD = process.env.KOC_TEST_PGPASSWORD;
const connection = ['--host', host, '--port', port];
if (process.env.KOC_TEST_PGUSER) connection.push('--username', process.env.KOC_TEST_PGUSER);
function command(binary, args) {
  const result = spawnSync(binary, [...connection, ...args], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed: ${result.stderr.trim()}`);
}
let created = false;
try {
  command('createdb', [database]);
  created = true;
  const files = [path.join(root, 'supabase/tests/bootstrap.sql'), ...readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => path.join(root, 'supabase/migrations', f)), path.join(root, 'supabase/tests/campus_workflows.sql'), path.join(root, 'supabase/tests/account_administration.sql'), path.join(root, 'supabase/tests/campus_lead_profiles.sql'), path.join(root, 'supabase/tests/weekly_admin_email_digest.sql'), path.join(root, 'supabase/tests/grace_chat.sql'), path.join(root, 'supabase/tests/username_accounts.sql'), path.join(root, 'supabase/tests/cluster_reports.sql'), path.join(root, 'supabase/tests/campus_lifecycle_roster.sql')];
  command('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', database, ...files.flatMap(file => ['--file', file])]);
  console.log('Database migration and campus authorization tests passed.');
} finally {
  if (created) command('dropdb', [database]);
}
