// Token Radar's dashboard: it reads window.RADAR (written beside dashboard/ by main.ts) and renders the
// ranked board, the live-token section and a detail drawer, all with no network: every byte it shows is
// in data.js.
//
// The model this page renders is radar-3, the one lib/model.ts scores:
//
//   base    = tvl_usd * category_multiplier   (the median mcap/TVL of the category's live-token peers)
//   implied = base * growth_multiplier * maturity_multiplier * freshness_multiplier
//
// A row arrives with every multiplier already computed, so this file multiplies and prints; it never
// re-derives a multiplier and never invents a number. The farm plan is the one exception: window.RADAR
// does not carry farm steps, so the page rebuilds the same six steps lib/model.ts writes to board.json.
(function (global) {
  'use strict';

  var doc = global.document;
  var DATA = global.RADAR;
  if (!doc || !DATA) return;

  var app = doc.getElementById('board');
  if (!app) return;

  var board = Array.isArray(DATA.rows) ? DATA.rows : [];
  var live = Array.isArray(DATA.live) ? DATA.live : [];
  var state = { q: '', category: 'all', sort: 'implied', watchlistOnly: false, selected: null };

  // ---------------------------------------------------------------- formatting
  /** Money: billions and millions abbreviated, the rest to the dollar. */
  function fmtUsd(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  /** A seven-day change as a signed percentage. */
  function fmtPct(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  /** A multiplier as the model prints it: four decimals, the way lib/model.ts rounds them. */
  function fmtMult(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    return n.toFixed(4);
  }

  /** An age in days as a compact span, or that the snapshot lists no date. */
  function fmtAge(days) {
    if (typeof days !== 'number' || !isFinite(days)) return 'no date on record';
    var d = Math.max(0, Math.round(days));
    if (d >= 730) return (d / 365).toFixed(1) + ' years';
    if (d >= 365) return '1 year';
    if (d >= 60) return Math.round(d / 30) + ' months';
    return d + (d === 1 ? ' day' : ' days');
  }

  /** A whole count with thousands separators. */
  function fmtCount(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** A finite number, else `fallback`: the model's own guard for a value the data may not carry. */
  function num(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  /** One element with attributes and children; `html` is never used, so no string becomes markup. */
  function el(tag, attrs) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'style') node.style.cssText = attrs[key];
        else if (key.slice(0, 2) === 'on' && typeof attrs[key] === 'function') node.addEventListener(key.slice(2), attrs[key]);
        else if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) {
          if (c) node.appendChild(c);
        });
      } else if (typeof child === 'string') {
        node.appendChild(doc.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  /** A label and a control, as the stylesheet expects them. */
  function field(labelText, control) {
    return el('div', { class: 'field' }, el('label', { for: control.id, text: labelText }), control);
  }

  // ---------------------------------------------------------------- farm plan
  // The same six steps lib/model.ts writes into board.json, from the same four facts: category, first
  // chain, TVL and age. No protocol name is special-cased.

  /** The first chain a protocol names. */
  function chainOf(row) {
    return row.chains && row.chains.length > 0 ? row.chains[0] : 'its main chain';
  }

  /** How much capital one farm position needs, from the protocol's own TVL. */
  function capitalFor(row) {
    if (row.tvl_usd >= 5e9) return 250;
    if (row.tvl_usd >= 1e9) return 150;
    if (row.tvl_usd >= 1e8) return 100;
    return 50;
  }

  /** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  /** The category's one action, in the words a farmer can follow. */
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  /** One step, with the cost and time the model attaches to it. */
  function step(text, cost, time) {
    return { text: text, cost: cost, time: time };
  }

  /** A protocol's farm plan: six steps, each an action with a cost and a time. */
  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      step('Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'),
      step(actionFor(row, capital, chain), '$' + capital + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'),
      step('Open the ' + row.name + ' app on ' + chain + ' from a bookmark you saved yourself, and check the points or rewards page it publishes.', 'no fee to look, and never pay to claim', '10 minutes'),
      step('Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', 'about $2 of gas a week', '10 minutes a week'),
      step('Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'),
      step('Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes')
    ];
  }

  // ---------------------------------------------------------------- the model breakdown
  // Every figure below is a field the row already carries; the page adds no arithmetic of its own.

  /** Where a category's multiple came from: its own live peers, or the global median fallback. */
  function multipleSource(row) {
    var sample = Math.round(num(row.comparables_sample, 0));
    if (sample > 0) {
      return 'the median market cap per dollar of TVL of the ' + sample + ' live-token ' + plural(sample, 'peer', 'peers') +
        ' the snapshot records in ' + (row.category || 'Other');
    }
    return 'the global median over every live-token protocol in the snapshot; this category has fewer than ' +
      Math.round(num(DATA.model && DATA.model.min_samples, 2)) + ' live peers to take a median from';
  }

  /** One word or its plural. */
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /** The four multipliers, as the labelled cells the stylesheet lays out. */
  function multiplierCells(row) {
    return [
      ['Growth', fmtMult(row.growth_multiplier), fmtPct(row.change_7d) + ' over seven days, clamped to ' +
        num(DATA.model && DATA.model.growth_floor, -60) + '..' + num(DATA.model && DATA.model.growth_cap, 120) +
        ' percent at ' + num(DATA.model && DATA.model.growth_weight, 0.6) + ' per percent'],
      ['Maturity', fmtMult(row.maturity_multiplier), fmtAge(row.age_days) + ' with no token'],
      ['Freshness', fmtMult(row.freshness_multiplier), 'from the same age, worth less the longer the protocol has run'],
      ['Category multiple', fmtMult(row.category_multiplier), 'mcap per dollar of TVL, ' + multipleSource(row)]
    ];
  }

  /** The breakdown a row's toggle opens: the four multipliers and where the category multiple came from. */
  function breakdown(row) {
    var grid = el('div', { class: 'mult-grid' });
    multiplierCells(row).forEach(function (cell) {
      grid.appendChild(el('div', { class: 'mult' }, el('span', { text: cell[0] }), el('b', { class: 'num', text: cell[1] }), el('i', { text: cell[2] })));
    });
    return el('div', { class: 'breakdown-body' },
      grid,
      el('div', { class: 'formula' }, 'base = ' + fmtUsd(row.tvl_usd) + ' x ' + fmtMult(row.category_multiplier) + ' = ' + fmtUsd(row.base_implied_usd) +
        '   |   implied = base x growth x maturity x freshness = ' + fmtMult(row.growth_multiplier) + ' x ' + fmtMult(row.maturity_multiplier) +
        ' x ' + fmtMult(row.freshness_multiplier) + ' = ' + fmtUsd(row.implied_value_usd)),
      el('p', { class: 'sub', text: 'The category multiple is ' + multipleSource(row) + '. Model ' + (DATA.model_version || 'n/a') + '.' })
    );
  }

  // ---------------------------------------------------------------- filtering and sorting
  /** The rows the controls currently admit. */
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = board.filter(function (row) {
      if (state.watchlistOnly && num(row.tvl_usd, 0) < num(DATA.floor_usd, 0)) return false;
      if (state.category !== 'all' && (row.category || 'Other') !== state.category) return false;
      if (!q) return true;
      var hay = [row.name, row.slug, row.category, (row.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    var key = state.sort;
    return list.sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') {
        av = num(a.tvl_usd, 0);
        bv = num(b.tvl_usd, 0);
      } else if (key === 'change') {
        av = num(a.change_7d, -Infinity);
        bv = num(b.change_7d, -Infinity);
      } else {
        av = num(a.implied_value_usd, 0);
        bv = num(b.implied_value_usd, 0);
      }
      if (av !== bv) return bv - av;
      return num(a.rank, 0) - num(b.rank, 0);
    });
  }

  // ---------------------------------------------------------------- the controls
  /** The search box, the category filter, the sort, and the watchlist toggle. */
  function controls() {
    var categories = [];
    board.forEach(function (row) {
      var key = row.category || 'Other';
      if (categories.indexOf(key) < 0) categories.push(key);
    });
    categories.sort();

    var search = el('input', { type: 'search', id: 'q', value: state.q, placeholder: 'Name, slug, category or chain', 'aria-label': 'Search the board' });
    search.addEventListener('input', function () {
      state.q = search.value;
      render();
    });

    var category = el('select', { id: 'category-filter', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories', selected: state.category === 'all' ? 'selected' : null }),
      categories.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      }));
    category.addEventListener('change', function () {
      state.category = category.value;
      render();
    });

    var sort = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      el('option', { value: 'implied', text: 'Implied value', selected: state.sort === 'implied' ? 'selected' : null }),
      el('option', { value: 'tvl', text: 'TVL', selected: state.sort === 'tvl' ? 'selected' : null }),
      el('option', { value: 'change', text: '7-day change', selected: state.sort === 'change' ? 'selected' : null }));
    sort.addEventListener('change', function () {
      state.sort = sort.value;
      render();
    });

    var watch = el('input', { type: 'checkbox', id: 'watchlist-only' });
    watch.checked = state.watchlistOnly;
    watch.addEventListener('change', function () {
      state.watchlistOnly = watch.checked;
      render();
    });

    var shown = filtered().length;
    return el('div', { class: 'controls' },
      field('Search', search),
      field('Category', category),
      field('Sort by', sort),
      el('label', { class: 'check', for: 'watchlist-only' }, watch, el('span', { text: 'Watchlist only' })),
      el('span', { class: 'count', text: fmtCount(shown) + ' of ' + fmtCount(board.length) + ' rows' })
    );
  }

  // ---------------------------------------------------------------- the board
  /** A row's toggle: the four multipliers and the category multiple's source, closed by default. */
  function breakdownToggle(row) {
    var details = el('details', { class: 'breakdown' });
    details.appendChild(el('summary', { text: 'Model breakdown' }));
    details.appendChild(breakdown(row));
    details.addEventListener('toggle', function () {
      // One open breakdown at a time keeps the table scannable.
      if (!details.open) return;
      var open = app.querySelectorAll('details.breakdown[open]');
      for (var i = 0; i < open.length; i++) if (open[i] !== details) open[i].removeAttribute('open');
    });
    return details;
  }

  /** The ranked board table. */
  function boardTable() {
    var list = filtered();
    if (list.length === 0) {
      return el('div', { class: 'panel' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { class: 'sub', text: 'Clear the search, pick another category, or turn off the watchlist filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: clearFilters }));
    }
    var tbody = el('tbody');
    list.forEach(function (row) {
      var tr = el('tr', { class: num(row.rank, 0) === 1 ? 'top1' : null },
        el('td', { class: 'rank', text: String(num(row.rank, 0)) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: row.name || row.slug || 'unnamed protocol' }),
          el('span', { class: 'slug', text: row.slug || '' }))),
        el('td', null, el('span', { class: 'chip', text: row.category || 'Other' })),
        el('td', { class: 'tvl', text: fmtUsd(row.tvl_usd) }),
        el('td', { class: 'chg ' + changeClass(row.change_7d), text: fmtPct(row.change_7d) }),
        el('td', { class: 'value implied', text: fmtUsd(row.implied_value_usd) }),
        el('td', null, breakdownToggle(row),
          el('button', { class: 'button', type: 'button', text: 'Details', onclick: function () { openDetail(row.slug); } }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols ranked by implied launch value, strongest first. Open a row\'s breakdown for its four multipliers, or its details for the full arithmetic and the farm plan.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Rank' }),
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Implied value' }),
            el('th', { scope: 'col', text: 'Model and plan' })
          )),
          tbody)));
  }

  /** The seven-day change's colour class, or nothing when the snapshot carries no change. */
  function changeClass(change) {
    if (typeof change !== 'number' || !isFinite(change)) return 'muted';
    return change >= 0 ? 'up' : 'down';
  }

  /** Clear every control back to the whole board. */
  function clearFilters() {
    state.q = '';
    state.category = 'all';
    state.watchlistOnly = false;
    render();
  }

  // ---------------------------------------------------------------- live tokens
  /** The live-token section: protocols that already trade, so their market cap is a fact not a model. */
  function liveSection() {
    var tbody = el('tbody');
    live.forEach(function (row) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: row.name || row.slug || 'unnamed protocol' }), el('span', { class: 'slug', text: row.slug || '' }))),
        el('td', null, el('span', { class: 'chip', text: row.category || 'Other' })),
        el('td', { class: 'tvl', text: fmtUsd(row.tvl_usd) }),
        el('td', { class: 'chg ' + changeClass(row.change_7d), text: fmtPct(row.change_7d) }),
        el('td', { class: 'value', text: fmtUsd(row.mcap_usd) })));
    });
    return el('section', { class: 'panel', id: 'live' },
      el('h2', { text: 'Live tokens' }),
      el('p', { class: 'sub', text: 'The ' + fmtCount(live.length) + ' most valuable live-token protocols in the snapshot. They already trade, so their market cap is a fact and never enters the model; they are the comparables the category multiples are measured from.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live-token protocols, largest market cap first, set aside from the ranking.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Market cap' })
          )),
          tbody)));
  }

  // ---------------------------------------------------------------- the head of the page
  /** The header line that states the comparables model in one paragraph. */
  function headLine() {
    var m = DATA.model || {};
    var model = DATA.model_version || 'radar-3';
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, ranked by implied launch value' }),
        el('p', { class: 'tagline', text: fmtCount(board.length) + ' pre-token protocols, scored ' + model + ' against the market\'s own comparables.' }),
        el('div', { class: 'contract' },
          el('b', { text: 'The comparables model: ' }),
          'a pre-token protocol\'s launch value is compared to the market cap its category\'s live-token peers carry per dollar of TVL. ',
          'The multiple is the median market cap per dollar of TVL over the live-token protocols the snapshot records in the same category, and where a category has fewer than ' + num(m.min_samples, 2) + ' of them, the median over every live-token protocol in the snapshot is used instead. ',
          'Implied value is the protocol\'s TVL at that multiple, moved by a growth multiplier from its seven-day change, a maturity multiplier from its age with no token, and a freshness multiplier from the same age, then lowered a dollar where two rows would otherwise tie. ',
          'It is an estimate from the snapshot\'s own figures, not a price and not a forecast.')) ,
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + (DATA.as_of || 'n/a') }),
        el('span', { text: model }),
        el('span', { text: fmtCount(board.length) + ' ranked rows' }),
        el('span', { text: fmtCount(live.length) + ' live tokens set aside' })));
  }

  // ---------------------------------------------------------------- the detail view
  /** Every number behind one row's implied value, in the order the model multiplies them. */
  function detailNumbers(row) {
    var rows = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Seven-day change', fmtPct(row.change_7d)],
      ['Age with no token', fmtAge(row.age_days)],
      ['Category multiple', fmtMult(row.category_multiplier)],
      ['Base implied value (TVL x category multiple)', fmtUsd(row.base_implied_usd)],
      ['Growth multiplier', fmtMult(row.growth_multiplier)],
      ['Maturity multiplier', fmtMult(row.maturity_multiplier)],
      ['Freshness multiplier', fmtMult(row.freshness_multiplier)],
      ['Combined modifier (growth x maturity x freshness)', fmtMult(row.modifier)],
      ['Implied value', fmtUsd(row.implied_value_usd)]
    ];
    if (num(row.adjust, 0) !== 0) rows.push(['Distinct-value adjustment', String(row.adjust)]);
    var box = el('div', { class: 'equation' });
    rows.forEach(function (pair) {
      box.appendChild(el('div', null, el('span', { text: pair[0] }), el('b', { class: 'num', text: pair[1] })));
    });
    return box;
  }

  /** The detail dialog: the full model breakdown and the farm plan. */
  function detailView(row) {
    var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
    dialog.appendChild(el('div', { class: 'detail-card' },
      el('div', { class: 'detail-head' },
        el('div', null,
          el('span', { class: 'slug', text: 'Rank ' + num(row.rank, 0) + ' of ' + fmtCount(board.length) }),
          el('h2', { id: 'detail-title', text: row.name || row.slug || 'unnamed protocol' }),
          el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })),
        el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Model breakdown' }),
        detailNumbers(row),
        el('p', { class: 'sub', text: 'Category multiple source: ' + multipleSource(row) + '. Base implied value is the TVL at that multiple, and the implied value is the base moved by the growth, maturity and freshness multipliers.' })),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'The multipliers' }),
        (function () {
          var grid = el('div', { class: 'mult-grid' });
          multiplierCells(row).forEach(function (cell) {
            grid.appendChild(el('div', { class: 'mult' }, el('span', { text: cell[0] }), el('b', { class: 'num', text: cell[1] }), el('i', { text: cell[2] })));
          });
          return grid;
        })()),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Farm plan' }),
        el('p', { class: 'sub', text: 'Six steps, sized from this protocol\'s own TVL and age. Nothing here is advice: check the protocol\'s own page before you deposit anything.' }),
        el('ol', { class: 'steps' }, farmSteps(row).map(function (s) {
          return el('li', null,
            el('b', { text: s.text }),
            el('span', { class: 'cost' }, el('b', { text: 'Cost: ' }), s.cost),
            el('span', { class: 'cost' }, el('b', { text: 'Time: ' }), s.time));
        })))));
    dialog.addEventListener('close', function () {
      state.selected = null;
    });
    return dialog;
  }

  /** Open one row's detail view, replacing any detail already open. */
  function openDetail(slug) {
    var row = board.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    var existing = doc.getElementById('detail');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var dialog = detailView(row);
    state.selected = slug;
    app.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  // ---------------------------------------------------------------- render
  function render() {
    app.textContent = '';
    app.appendChild(headLine());
    app.appendChild(controls());
    app.appendChild(boardTable());
    app.appendChild(liveSection());
    app.setAttribute('aria-busy', 'false');
  }

  render();
  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.selected !== null) {
      var open = doc.getElementById('detail');
      if (open) open.close();
    }
  });
  if (global.RadarAside && typeof global.RadarAside.render === 'function') global.RadarAside.render(doc, DATA);
})(typeof globalThis === 'object' ? globalThis : this);
