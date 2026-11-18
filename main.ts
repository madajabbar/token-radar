// token-radar-01 entry point (Node 22+, standard library only, erasable TypeScript).
//
// Reads one sealed snapshot (--input <snapshot.json|directory>, else /input/snapshot.json), scores every
// pre-token protocol with lib/model.ts, and writes the hand-in:
//
//   /output/board.json      the ranked board, { row_count, rows }
//   /output/data.js         window.RADAR = {...}, the dashboard's whole dataset
//   /output/dashboard/      dashboard/ copied beside it (index.html reads ../data.js)
//   /output/screenshots/    screenshots/ copied beside it
//   /output/dossier.json    the vendored make.fun dossier of the two above
//
// The dashboard is static: no build, no install, no network. The dossier is written last, because the
// scorer rebuilds it from the rest of /output and compares bytes; it is only correct when the outputs it
// describes are already in place.
//
// Exit codes are the gate's: 2 when there is no snapshot to read, 1 when the board fails lib/model.ts's
// boardIssue or fewer than three screenshots are handed in, 0 otherwise.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, type Snapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** main.ts's own directory: where dashboard/ and screenshots/ live, whatever the working directory is. */
const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's text cap (reference/gate.json): the one cap that shapes the dossier's bytes. */
const TEXT_MAX_BYTES = 65_536;
/** The scorer's remaining caps. They only refuse: a dossier that would need them is a bad hand-in. */
const CAPS = {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
};

/** The gate's floor: a board with fewer rows than this is not a board. */
const MIN_SCREENSHOTS = 3;

/** An argument value: `--name value` or `--name=value`, else the fallback. */
function option(name: string, fallback: string): string {
  const flag = `--${name}`;
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && i + 1 < argv.length) return argv[i + 1]!;
    if (argv[i]!.startsWith(`${flag}=`)) return argv[i]!.slice(flag.length + 1);
  }
  return fallback;
}

/** Why the run cannot start: no snapshot at `input`, or a snapshot the model refuses. */
function fail(code: number, message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

/** The snapshot's path: the --input value itself, or its snapshot.json when it is a directory. */
function snapshotPath(input: string): string {
  return input.endsWith('.json') ? input : join(input, 'snapshot.json');
}

/** A protocol with no token on record is pre-token; the rest already trade and never enter the board. */
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

/** Copy one directory's regular, non-dot files into `to`, and return their names. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    names.push(name);
  }
  return names;
}

// ---------------------------------------------------------------- run

// The snapshot first: exit 2 before anything is written, so a bad run never leaves a half an output.
const snapshot = loadSnapshot(option('input', '/input'));
const out = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(1, `the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
const boardPath = join(out, 'board.json');
const dataPath = join(out, 'data.js');
writeFileSync(boardPath, `${JSON.stringify({ row_count: board.length, rows: board })}\n`);
writeFileSync(dataPath, dataScript(radar));

const dashboardDir = join(out, 'dashboard');
const screenshotsDir = join(out, 'screenshots');
const dashboardFiles = copyDir(join(HERE, 'dashboard'), dashboardDir);
const shots = copyDir(join(HERE, 'screenshots'), screenshotsDir);
if (shots.length < MIN_SCREENSHOTS) {
  fail(
    1,
    `screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in ${MIN_SCREENSHOTS} — the board, a detail view and a filtered view`,
  );
}

// The dossier is a description of what is already in `out`, and must be written last.
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, buildDossier(out, CAPS));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${boardPath}, ${dataPath}, ${dashboardDir} (${dashboardFiles.length} files), ${screenshotsDir} (${shots.length} images) and ${dossierPath}\n`,
);
