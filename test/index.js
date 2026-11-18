// `node --test test/` resolves a directory argument straight to this file on
// Node 22 and Node 24+; bare `node --test` already discovers radar.test.ts.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv[1] === dirname(fileURLToPath(import.meta.url))) {
  await import('./radar.test.ts');
}
