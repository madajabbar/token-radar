// Token Radar's aside: the derived numbers the ranked table does not carry.
//
// app.js owns the board and the detail drawer; this module owns the four stats in the summary row, the
// top-ten list, the per-category breakdown and the fact list beside the board. It reads the same
// window.RADAR that main.ts writes to data.js and recomputes nothing the model already decided: every
// figure here is a sum, a share or a count over rows app.js also renders.
//
// It is dependency-free, runs after app.js, and degrades quietly: with no window.RADAR or no document it
// returns, and a slot whose element is missing is simply skipped, so a trimmed page still loads.
(function (global) {
  'use strict';

  var RADAR = global.RADAR;

  /** A finite positive number, else 0: every sum and share here runs over these. */
  function safeNumber(value) {
    return typeof value === 'number' && isFinite(value) && value > 0 ? value : 0;
  }

  /** Money the way the board prints it: billions and millions abbreviated, the rest to the dollar. */
  function fmtUsd(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  /** A whole count with thousands separators. */
  function fmtCount(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** One category's share of the board, strongest category first. */
  function categoryBreakdown(rows) {
    var buckets = {};
    var order = [];
    rows.forEach(function (row) {
      var key = row && row.category ? row.category : 'Other';
      if (!buckets[key]) {
        buckets[key] = { category: key, rows: 0, total: 0, top: 0 };
        order.push(key);
      }
      var bucket = buckets[key];
      bucket.rows += 1;
      bucket.total += safeNumber(row.implied_value_usd);
      if (row.implied_value_usd > bucket.top) bucket.top = row.implied_value_usd;
    });
    return order
      .map(function (key) { return buckets[key]; })
      .sort(function (a, b) { return b.total - a.total || (a.category < b.category ? -1 : 1); });
  }

  /** The board's rows, strongest implied value first, as data.js already sorted them. */
  function ranked(rows) {
    return rows.slice().sort(function (a, b) {
      return safeNumber(b.implied_value_usd) - safeNumber(a.implied_value_usd);
    });
  }

  /** The middle implied value of a sorted list: the average of the two middles when the count is even. */
  function median(sorted) {
    if (sorted.length === 0) return 0;
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return safeNumber(sorted[mid].implied_value_usd);
    return (safeNumber(sorted[mid - 1].implied_value_usd) + safeNumber(sorted[mid].implied_value_usd)) / 2;
  }

  /**
   * Every derived figure the aside shows, from the dashboard's dataset and nothing else.
   *
   * @param radar The window.RADAR dataset written beside the page.
   * @returns Counts, totals, the top ten rows and the per-category breakdown.
   */
  function computeStats(radar) {
    var data = radar && typeof radar === 'object' ? radar : {};
    var rows = Array.isArray(data.rows) ? data.rows : [];
    var live = Array.isArray(data.live) ? data.live : [];
    var watchlistSize = safeNumber(data.watchlist_size);
    var sorted = ranked(rows);
    var total = 0;
    var chains = {};
    rows.forEach(function (row) {
      total += safeNumber(row.implied_value_usd);
      (row && Array.isArray(row.chains) ? row.chains : []).forEach(function (chain) { chains[chain] = true; });
    });
    var categories = categoryBreakdown(rows);
    var top = safeNumber(sorted.length > 0 ? sorted[0].implied_value_usd : 0);
    var watchlistRows = rows.filter(function (row) {
      return row && row.category !== undefined && safeNumber(data.floor_usd) > 0 && row.tvl_usd >= data.floor_usd;
    }).length;
    return {
      protocols: safeNumber(data.watchlist_size) + safeNumber(data.early_size) + safeNumber(data.live_size),
      boardRows: rows.length,
      liveRows: live.length,
      watchlistSize: watchlistSize,
      watchlistRows: watchlistRows,
      earlyRows: safeNumber(data.early_size),
      categories: categories,
      categoryCount: categories.length,
      chainCount: Object.keys(chains).length,
      total: total,
      median: median(sorted),
      top: top,
      topRows: sorted.slice(0, 10),
      topFilled: data.watchlist_size === rows.length - safeNumber(data.early_size),
      farmSignals: rows.filter(function (row) { return row && safeNumber(row.implied_value_usd) > 0; }).length
    };
  }

  /** Put `text` in the element with this id, or leave the page alone when it is not there. */
  function setText(doc, id, text) {
    var node = doc.getElementById(id);
    if (node) node.textContent = text;
  }

  /** An element with attributes and children, built without innerHTML. */
  function el(doc, tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'style') node.style.cssText = attrs[key];
        else if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  /** One top-ten entry: the rank, the name, the implied value and its share of the board. */
  function topEntry(doc, row, rank, total) {
    var implied = safeNumber(row.implied_value_usd);
    var share = total > 0 ? Math.round((implied / total) * 1000) / 10 : 0;
    return el(doc, 'li', { class: 'top-item' }, [
      el(doc, 'span', { class: 'top-rank num', text: String(rank) }),
      el(doc, 'span', { class: 'top-name', text: row.name || row.slug || 'unnamed protocol' }),
      el(doc, 'span', { class: 'top-cat sub', text: row.category || 'Other' }),
      el(doc, 'b', { class: 'top-value num', text: fmtUsd(implied) }),
      el(doc, 'span', { class: 'top-share num', text: share.toFixed(1) + '%', title: 'share of the board total' })
    ]);
  }

  /** One category row: the bar, the name, the row count and the category's total. */
  function categoryEntry(doc, bucket, maxTotal, total) {
    var width = maxTotal > 0 ? Math.max(2, Math.round((bucket.total / maxTotal) * 100)) : 0;
    var share = total > 0 ? Math.round((bucket.total / total) * 1000) / 10 : 0;
    return el(doc, 'li', { class: 'cat-item' }, [
      el(doc, 'div', { class: 'cat-head' }, [
        el(doc, 'b', { class: 'cat-name', text: bucket.category }),
        el(doc, 'span', { class: 'cat-count sub', text: bucket.rows + (bucket.rows === 1 ? ' row' : ' rows') }),
        el(doc, 'span', { class: 'cat-total num', text: fmtUsd(bucket.total) }),
        el(doc, 'span', { class: 'cat-share num', text: share.toFixed(1) + '%' })
      ]),
      el(doc, 'div', { class: 'cat-bar bar', 'aria-hidden': 'true' }, [
        el(doc, 'i', { style: 'width:' + width + '%' })
      ])
    ]);
  }

  /** Fill every slot this module owns. Missing slots are skipped, never an error. */
  function render(doc, radar) {
    var stats = computeStats(radar);
    setText(doc, 'stat-protocols', fmtCount(stats.protocols));
    setText(doc, 'stat-protocols-note', fmtCount(stats.boardRows) + ' scored, ' + fmtCount(stats.liveRows) + ' live set aside');
    setText(doc, 'stat-watchlist', fmtCount(stats.watchlistRows) + ' / ' + fmtCount(stats.watchlistSize));
    setText(doc, 'stat-watchlist-note', stats.watchlistRows >= stats.watchlistSize ? 'every watchlist slug is on the board' : 'watchlist slugs the board carries');
    setText(doc, 'stat-top', fmtUsd(stats.top));
    setText(doc, 'stat-top-note', stats.topRows.length > 0 ? 'held by ' + (stats.topRows[0].name || stats.topRows[0].slug) : 'the strongest pre-token row');
    setText(doc, 'stat-farm', fmtCount(stats.farmSignals));
    setText(doc, 'stat-farm-note', 'rows with a six-step plan');

    setText(doc, 'aside-rows', fmtCount(stats.boardRows));
    setText(doc, 'aside-watchlist-rows', fmtCount(stats.watchlistRows));
    setText(doc, 'aside-early', fmtCount(stats.earlyRows));
    setText(doc, 'aside-live', fmtCount(stats.liveRows));
    setText(doc, 'aside-median', fmtUsd(stats.median));
    setText(doc, 'aside-total', fmtUsd(stats.total));
    setText(doc, 'aside-chains', fmtCount(stats.chainCount));
    setText(doc, 'aside-cat-count', fmtCount(stats.categoryCount));
    setText(doc, 'footer-as-of', String((radar && radar.as_of) || 'n/a'));
    setText(doc, 'footer-model', String((radar && radar.model_version) || 'n/a'));
    setText(doc, 'footer-source', String((radar && radar.source) || 'n/a'));

    var many = stats.categoryCount === 1 ? 'category' : 'categories';
    setText(doc, 'aside-line',
      fmtCount(stats.boardRows) + ' rows across ' + fmtCount(stats.categoryCount) + ' ' + many +
      ' and ' + fmtCount(stats.chainCount) + ' chains, ' + fmtUsd(stats.total) + ' of implied value in total.');

    var topList = doc.getElementById('aside-top-ten');
    if (topList) {
      topList.textContent = '';
      stats.topRows.forEach(function (row, i) { topList.appendChild(topEntry(doc, row, i + 1, stats.total)); });
    }
    var catList = doc.getElementById('aside-categories');
    if (catList) {
      catList.textContent = '';
      var maxTotal = stats.categories.length > 0 ? stats.categories[0].total : 0;
      stats.categories.forEach(function (bucket) { catList.appendChild(categoryEntry(doc, bucket, maxTotal, stats.total)); });
    }
    return stats;
  }

  var API = { computeStats: computeStats, categoryBreakdown: categoryBreakdown, median: median, fmtUsd: fmtUsd, render: render };
  global.RadarAside = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (global.document) render(global.document, RADAR);
})(typeof globalThis === 'object' ? globalThis : this);
