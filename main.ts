// token-radar-01 — entry point for the make.fun hand-in (Node 22+, standard library only, erasable TS).
//
// One sealed snapshot goes in; a static dashboard hand-in comes out. This file owns only the CLI and the
// output contract: scoring, ranking and dossier assembly live in lib/model.ts and vendor/makefun-board.ts.
//
//   node main.ts --input <snapshot.json|directory> [--output <directory>]
//
// --input falls back to /input; --output falls back to $MAKEFUN_OUTPUT_DIR, then /output. The snapshot is
// read and scored before a single byte is written, so a bad run leaves no half-written output tree:
// exit 2 means there was no snapshot to read, exit 1 means the scored board failed the gate.
//
// Write order is fixed: board.json, data.js, dashboard/, screenshots/, and dossier.json last — the
// vendored scorer rebuilds the dossier from the files already on disk, so they must all be in place first.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
  type BoardRow,
  type RadarData,
  type Snapshot,
} from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** This file's directory: dashboard/ and screenshots/ sit beside it, wherever the process is started. */
const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The caps the vendored scorer checks a dossier against (reference/gate.json). */
const CAPS = {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
};

/** The gate's floor: fewer screenshots than this is not a hand-in. */
const SCREENSHOT_FLOOR = 3;

/** First `--name <value>` or `--name=<value>` on the command line, else `fallback`. */
function option(name: string, fallback: string): string {
  const bare = `--${name}`;
  const prefixed = `${bare}=`;
  for (const [i, current] of process.argv.entries()) {
    if (current === bare) {
      if (i + 1 < process.argv.length) return process.argv[i + 1]!;
      continue;
    }
    if (current.startsWith(prefixed)) return current.slice(prefixed.length);
  }
  return fallback;
}

/** Print `message` to stderr under the tool's prefix and exit with `code`. */
function fail(code: number, message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

/** `input` may name the snapshot file itself or a directory holding snapshot.json. */
function snapshotPath(input: string): string {
  return input.endsWith('.json') ? input : join(input, 'snapshot.json');
}

/** Read and parse the sealed snapshot; exit 2 when it is absent or unreadable. */
function loadSnapshot(input: string): Snapshot {
  const path = snapshotPath(input);
  if (!existsSync(path)) {
    fail(2, `no snapshot at ${path}: pass --input <snapshot.json|directory>, or mount the sealed /input`);
  }
  try {
    return parseSnapshot(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(2, `${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Copy `from`'s regular, non-dot files into `to`; returns the names copied, [] if `from` is absent. */
function copyInto(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    copied.push(name);
  }
  return copied;
}

/** Exit 1 unless `shots` clears the gate's screenshot floor. */
function assertEnoughShots(shots: string[]): void {
  if (shots.length >= SCREENSHOT_FLOOR) return;
  fail(
    1,
    `screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in ${SCREENSHOT_FLOOR} — the board, a detail view and a filtered view`,
  );
}

/** Write the ranked board and the dashboard dataset under `output`; returns both paths. */
function writeBoard(output: string, board: BoardRow[], radar: RadarData): { boardPath: string; dataPath: string } {
  const boardPath = join(output, 'board.json');
  const dataPath = join(output, 'data.js');
  writeFileSync(boardPath, `${JSON.stringify({ row_count: board.length, rows: board })}\n`);
  writeFileSync(dataPath, dataScript(radar));
  return { boardPath, dataPath };
}

// --------------------------------------------------------------------------------------------- run

// The snapshot comes first: exit before the output directory is created or touched.
const snapshot = loadSnapshot(option('input', '/input'));
const output = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(1, `the model wrote a board the gate refuses: ${issue}`);

mkdirSync(output, { recursive: true });
const { boardPath, dataPath } = writeBoard(output, board, radar);

const dashboardDir = join(output, 'dashboard');
const screenshotsDir = join(output, 'screenshots');
const dashboardFiles = copyInto(join(HERE, 'dashboard'), dashboardDir);
const shots = copyInto(join(HERE, 'screenshots'), screenshotsDir);
assertEnoughShots(shots);

// Written last: the dossier describes the outputs that are already on disk.
const dossierPath = join(output, 'dossier.json');
writeFileSync(dossierPath, buildDossier(output, CAPS));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${boardPath}, ${dataPath}, ${dashboardDir} (${dashboardFiles.length} files), ${screenshotsDir} (${shots.length} images) and ${dossierPath}\n`,
);
