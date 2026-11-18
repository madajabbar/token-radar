// The board's gate, run as a test: the same invariants lib/model.ts's boardIssue checks, plus the
// watchlist coverage and farm-step bounds the competition scores.
//
//   node --experimental-strip-types --test test/radar.test.ts
//
// The board is built in process from the sealed snapshot, so no output directory and no prior run of
// main.ts is needed. The aside module is checked by importing it: it runs in a plain Node global, so
// the same file the page loads also answers here.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { boardIssue, buildRadar, parseSnapshot } from '../lib/model.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = '/home/mada/makefun/token-radar-01-kit/input/snapshot.json';

/** The snapshot's path: the competition's sealed input, else any snapshot.json in the repo. */
function snapshotPath(): string {
  if (existsSync(SNAPSHOT)) return SNAPSHOT;
  const local = join(HERE, '..', 'snapshot.json');
  if (existsSync(local)) return local;
  throw new Error(`no snapshot to score: expected ${SNAPSHOT} or ${local}`);
}

const snapshot = parseSnapshot(readFileSync(snapshotPath(), 'utf8'));
const { board, radar } = buildRadar(snapshot);

/** The board's implied values, in rank order. */
const values = board.map((row) => row.implied_value_usd);

describe('the ranked board', () => {
  it('has 200 rows', () => {
    assert.equal(board.length, 200);
    assert.equal(radar.board_size, 200);
  });

  it('ranks every row 1..200 with no gap and no repeat', () => {
    const ranks = board.map((row) => row.rank);
    assert.deepEqual(
      ranks,
      Array.from({ length: 200 }, (_, i) => i + 1),
      'ranks are contiguous and ascending',
    );
  });

  it('is strictly descending by implied value', () => {
    for (let i = 1; i < board.length; i++) {
      assert.ok(
        board[i]!.implied_value_usd < board[i - 1]!.implied_value_usd,
        `row ${i + 1} (${board[i]!.implied_value_usd}) does not rank below row ${i} (${board[i - 1]!.implied_value_usd})`,
      );
    }
    assert.equal(new Set(values).size, board.length, 'implied values are distinct');
  });

  it('covers the watchlist', () => {
    const slugs = new Set(board.map((row) => row.slug));
    const missing = snapshot.watchlist.filter((slug) => !slugs.has(slug));
    assert.deepEqual(missing, [], 'every watchlist slug is on the board');
    assert.equal(snapshot.watchlist.length, radar.watchlist_size);
  });

  it('gives every row farm steps within the gate', () => {
    for (const row of board) {
      const steps = row.farm_steps;
      assert.ok(
        steps.length >= 3 && steps.length <= 12,
        `${row.slug} has ${steps.length} farm steps: the gate wants 3..12`,
      );
      for (const step of steps) {
        assert.ok(
          step.length >= 20 && step.length <= 600,
          `${row.slug} has a farm step of ${step.length} characters: the gate wants 20..600`,
        );
      }
    }
  });

  it("passes boardIssue, the model's own gate", () => {
    assert.equal(boardIssue(board, snapshot), null);
  });

  it('scored more rows than the watchlist floor, in pre-token order', () => {
    assert.ok(radar.early_size > 0, 'the early radar found rows below the floor');
    assert.equal(radar.early_size, 160);
    assert.equal(radar.live_size, 24);
    assert.equal(radar.rows.length, board.length);
    for (const row of board) {
      assert.equal(row.token_status, 'pre-token');
      assert.equal(row.mcap_usd, null);
      assert.equal(row.gecko_id, null);
      assert.equal(row.symbol, null);
    }
  });
});

describe('the aside module', () => {
  it('derives the same totals the board shows', async () => {
    await import('../dashboard/aside.js');
    const api: { computeStats(radar: unknown): Record<string, unknown> } | undefined = globalThis.RadarAside;
    assert.ok(api, 'aside.js publishes RadarAside');
    const stats = api.computeStats(radar);
    assert.equal(stats.boardRows, board.length);
    assert.equal(stats.watchlistRows, snapshot.watchlist.length);
    assert.equal(stats.earlyRows, radar.early_size);
    assert.equal(stats.liveRows, radar.live_size);
    assert.equal(stats.categoryCount, new Set(radar.rows.map((row) => row.category ?? 'Other')).size);
    assert.equal(stats.topRows.length, 10);
    assert.equal(stats.top, values[0]);
    assert.ok((stats.total as number) > 0);
  });
});
