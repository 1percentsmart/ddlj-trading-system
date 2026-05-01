import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next', 'standalone');

if (!existsSync(standaloneDir)) {
  process.exit(0);
}

await mkdir(join(standaloneDir, '.next'), { recursive: true });

const copies = [
  [join(root, '.next', 'static'), join(standaloneDir, '.next', 'static')],
  [join(root, 'public'), join(standaloneDir, 'public')],
];

for (const [source, target] of copies) {
  if (existsSync(source)) {
    await cp(source, target, { recursive: true, force: true });
  }
}
