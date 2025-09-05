import { promises as fs } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

async function main() {
  const root = process.cwd();
  const pubDir = path.join(root, 'public');

  try {
    await fs.mkdir(pubDir, { recursive: true });
  } catch {}

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

  const get = (cmd) => {
    try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { return ''; }
  };

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || get('git rev-parse --short HEAD');
  const branch = process.env.VERCEL_GIT_COMMIT_REF || get('git rev-parse --abbrev-ref HEAD');
  const builtAt = new Date().toISOString();

  const payload = {
    status: 'ok',
    app: pkg.name,
    version: pkg.version,
    branch: branch || undefined,
    commit: commitSha || undefined,
    builtAt,
  };

  await fs.writeFile(path.join(pubDir, 'health.json'), JSON.stringify(payload, null, 2) + '\n');
  await fs.writeFile(path.join(pubDir, 'version.txt'), `${pkg.name}@${pkg.version}\n${commitSha}\n${builtAt}\n`);
}

main().catch((err) => {
  console.error('Failed to write health files:', err);
  process.exit(1);
});

