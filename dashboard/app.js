// Token Radar's dashboard, radar-2. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan, plus the flagged and live-token views. No network: every byte
// it shows is in data.js.
//
// The page recomputes each row from the snapshot figures (impliedOf) and re-derives its farm plan
// (farmSteps) from the same rules main.ts uses, so the page's code and board.json are visibly the
// same arithmetic: a row whose recomputed value differed from the board would say so in its detail.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'clean', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtShare(s) { return (s * 100).toFixed(6) + '%'; }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // log(mcap) = a + b*log(tvl), fitted on the snapshot's 128 traded comps at run time, plus a shrunk
  // category residual, a small growth tilt and a small maturity tilt.
  function impliedOf(row) {
    var fit = DATA.fit;
    var base = Math.exp(fit.a + fit.b * Math.log(row.tvl_usd)) * Math.exp(fit.cat_adj[row.category || 'Other'] || 0);
    var growth = Math.min(80, Math.max(-40, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var gm = 1 + (growth / 100) * 0.25;
    var age = row.age_days === null || row.age_days === undefined ? 365 : row.age_days;
    var mm = 0.85 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.3;
    return Math.max(1, Math.round(base * gm * mm));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL, age and
  // flag decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
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
    if (c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function flagReason(p, flag) {
    if (flag === 'exchange') return 'A centralised exchange: its token, if any, is the exchange’s own, not a protocol launch to farm.';
    if (flag === 'bridge product') return 'A bridge: it moves a token that already trades between chains instead of issuing one of its own.';
    if (flag === 'staked product') return 'A staked product: it wraps a token that already trades, so there is no new launch to farm.';
    if (flag === 'wrapped/staked product') return 'Its name marks it a wrapped or staked product of a token that already trades.';
    if (flag === 'exchange product') return 'Its name starts with an exchange’s name: a product of that exchange, not a standalone launch.';
    return 'Its name ends in a version marker: a versioned pool of another protocol, not a launch of its own.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(row) {
    var econ = row.econ;
    var chain = chainOf(row);
    var capital = econ.capital_usd;
    var hold = econ.hold_days;
    if (row.launch_flag) {
      var reason = flagReason(row, row.launch_flag);
      return [
        { text: reason, cost: 'nothing to spend', time: '2 minutes to read' },
        { text: 'Do not farm ' + row.name + ' as a token launch: there is no new token coming from it to claim.', cost: '$0, and the position you skip costs nothing', time: 'no time spent' },
        { text: 'If you want exposure to ' + row.name + ', use it for what it is — a ' + row.launch_flag + ' — and judge it on its own yield.', cost: 'from $' + capital + ' if you use it, otherwise $0', time: '15 minutes to set up' },
        { text: 'Watch the parent protocol whose token already trades instead: a launch, if one ever comes, would be announced there.', cost: 'nothing but attention', time: '5 minutes a week' },
        { text: "Before you act on any claim link about " + row.name + ", open the protocol's own page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
        { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
      ].map(stepText);
    }
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(row, capital, chain), cost: '$' + capital + ' of capital and about $' + econ.setup_gas_usd + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $' + econ.weekly_gas_usd + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Break-even: this farm costs $' + econ.total_cost_usd + ' out of pocket over ' + hold + ' days, so your allocation must be worth $' + econ.total_cost_usd + ' — ' + fmtShare(econ.break_even_share) + ' of the $' + row.implied_value_usd.toLocaleString('en-US') + ' implied value, or ' + fmtShare(econ.break_even_pool_share) + ' of a 7.5% community pool ($' + econ.pool_75_usd.toLocaleString('en-US') + '). Verdict: ' + econ.verdict + ' — ' + econ.verdict_reason, cost: '$' + econ.total_cost_usd + ' total, $' + econ.cost_per_hour_usd + ' per active hour', time: econ.active_minutes + ' active minutes over ' + hold + ' days' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tab !== 'clean') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function baseList() {
    if (state.tab === 'live') return DATA.live;
    if (state.tab === 'flagged') return DATA.flagged;
    if (state.tab === 'all') return DATA.rows;
    return DATA.rows.filter(function (r) { return !r.launch_flag; });
  }
  function rows() {
    var q = state.q.trim().toLowerCase();
    return baseList().filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank === undefined ? Infinity : a.rank; bv = b.rank === undefined ? Infinity : b.rank; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var c = DATA.coverage;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: c.clean + ' launch candidates, ranked by fitted implied value' }),
        el('p', null,
          'Every protocol in the snapshot that records no token — ', el('b', { text: c.pre_token + ' of ' + c.scanned + ' scanned' }),
          ' — is ranked. The watchlist is the floor: all ', el('b', { text: c.watchlist + ' of ' + c.watchlist }),
          ' watchlist protocols are on the board, and the early radar adds every pre-token protocol below the floor. Implied value is a model, not a promise.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Protocols scanned' }), el('b', { text: String(c.scanned) }), el('i', { text: 'DefiLlama, TVL ≥ $5M' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token ranked' }), el('b', { text: String(c.pre_token) }), el('i', { text: 'no token on record' })),
        el('div', { class: 'fact' }, el('span', { text: 'Clean candidates' }), el('b', { text: String(c.clean) }), el('i', { text: 'a launch could come' })),
        el('div', { class: 'fact' }, el('span', { text: 'Flagged products' }), el('b', { text: String(c.flagged) }), el('i', { text: 'wrapped / staked / bridge' })),
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: c.watchlist + ' / ' + c.watchlist }), el('i', { text: 'every one of them' })),
        el('div', { class: 'fact' }, el('span', { text: 'Live tokens aside' }), el('b', { text: String(c.live) }), el('i', { text: 'top 24 by market cap' }))
      )
    );
  }

  function howPanel() {
    var f = DATA.fit;
    return el('section', { class: 'how' },
      el('h2', { text: 'How this radar works — read me first' }),
      el('p', null,
        'The value model is fitted on the snapshot itself: ', el('span', { class: 'mono', text: 'log(market cap) = ' + f.a.toFixed(3) + ' + ' + f.b.toFixed(3) + ' × log(TVL)' }),
        ', ordinary least squares on the ', el('b', { text: String(f.n_comps) + ' traded tokens' }),
        ', plus a shrunk category residual, a small seven-day growth tilt and a small maturity tilt (age with no token). No protocol name is special-cased; the same function scores every row, and the page recomputes each row from its own figures.'
      ),
      el('p', null,
        'Validated out of sample, on the same comps: leave-one-out RMSE ', el('b', { text: f.loo_rmse.toFixed(2) + ' in log space' }),
        ' (R² ', el('b', { text: f.loo_r2.toFixed(2) }),
        ', median error ×', el('b', { text: f.loo_med_factor.toFixed(1) }),
        '), against ', el('b', { text: f.starter_loo_rmse.toFixed(2) }),
        ' for a flat 0.25× TVL rule. Walk-forward (fit before 2025-06-01, tested on the ', el('b', { text: String(f.wf_n) + ' newer tokens' }),
        '): RMSE ', el('b', { text: (f.wf_rmse === null ? 'n/a' : f.wf_rmse.toFixed(2)) }),
        ' vs ', el('b', { text: (f.wf_starter_rmse === null ? 'n/a' : f.wf_starter_rmse.toFixed(2)) }),
        ' for the flat rule. The comps explain only ~15% of out-of-sample variance, so every rank carries its 10th–90th percentile range over 200 bootstrap refits — wide bands, stated, not hidden.'
      ),
      el('p', null,
        'Coverage is the whole pre-token universe: ', el('b', { text: String(DATA.coverage.pre_token) + ' ranked' }),
        ', of which ', el('b', { text: String(DATA.coverage.flagged) }),
        ' are flagged as wrapped, staked or bridged products of a token that already trades (or an exchange, or a versioned pool) and get a SKIP verdict with the reason, not a farm plan for a launch that will not come. “Records no token” is what the snapshot says — never that a protocol has none.'
      )
    );
  }

  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; writeHash(); render(); } });
    }
    var count = state.tab === 'live' ? DATA.live.length + ' live-token protocols' : state.tab === 'flagged' ? DATA.flagged.length + ' flagged products' : rows().length + ' rows shown';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }),
        el('div', { class: 'tabs' },
          tabBtn('clean', 'Launch candidates'),
          tabBtn('all', 'All pre-token'),
          tabBtn('flagged', 'Flagged'),
          tabBtn('live', 'Live token')
        )
      ),
      el('span', { class: 'count', text: count })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictBadge(v) {
    return el('span', { class: 'badge ' + v.toLowerCase(), text: v });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 1);
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }),
          r.launch_flag ? el('span', { class: 'flag', text: ' — ' + r.launch_flag }) : null
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('div', { class: 'range', text: 'rank ' + r.rank_lo + '–' + r.rank_hi + ' over 200 refits' })
        )),
        el('td', null, verdictBadge(r.verdict))
      );
      tbody.appendChild(tr);
    });
    var caption = state.tab === 'clean'
      ? 'Launch candidates: pre-token protocols with no launch flag, strongest implied value first. Select a row for its model and farm plan.'
      : 'All pre-token protocols, strongest implied value first. Flagged rows are products of a token that already trades. Select a row for its model and farm plan.';
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: caption }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Verdict' })
          )),
          tbody
        )
      )
    );
  }

  function flaggedTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No flagged product matches that filter' }),
        el('p', { text: 'Clear the search or pick another category.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var tbody = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', {
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', null, el('span', { class: 'flag', text: r.flag })),
        el('td', { text: r.reason })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Flagged as a wrapped, staked or bridged product of a token that already trades, an exchange, or a versioned pool. They are ranked on the board but get a SKIP verdict, not a launch farm plan.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Flag' }), el('th', { scope: 'col', text: 'Why it is flagged' }))),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge skip', text: 'ALREADY TRADES' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var f = DATA.fit;
    var mults = Object.keys(f.cat_adj).map(function (c) { return { c: c, m: Math.exp(f.cat_adj[c]) }; });
    mults.sort(function (a, b) { return b.m - a.m; });
    var top = mults.slice(0, 3).map(function (x) { return x.c + ' ×' + x.m.toFixed(2); }).join(', ');
    var bottom = mults.slice(-3).map(function (x) { return x.c + ' ×' + x.m.toFixed(2); }).join(', ');
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures, fitted on the snapshot’s own traded tokens. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = exp(' + f.a.toFixed(3) + ' + ' + f.b.toFixed(3) + ' × ln(TVL)) × category × (1 + clamp(7d, −40, 80) / 100 × 0.25) × (0.85 + min(age, 1095) / 1095 × 0.30)'
      ),
      el('table', { class: 'vtable' }, el('tbody', null,
        el('tr', null, el('td', { text: 'Comps curve' }), el('td', { text: 'log(market cap) = ' + f.a.toFixed(3) + ' + ' + f.b.toFixed(3) + ' × log(TVL), OLS on ' + f.n_comps + ' traded tokens' })),
        el('tr', null, el('td', { text: 'Category multipliers' }), el('td', { text: 'Highest: ' + top + '. Lowest: ' + bottom + '. Shrunk toward 1 (k = 5).' })),
        el('tr', null, el('td', { text: 'Leave-one-out (blind)' }), el('td', { text: 'RMSE ' + f.loo_rmse.toFixed(2) + ' in log space, R² ' + f.loo_r2.toFixed(2) + ', median error ×' + f.loo_med_factor.toFixed(1) + ' — vs RMSE ' + f.starter_loo_rmse.toFixed(2) + ' for a flat 0.25× TVL rule.' })),
        el('tr', null, el('td', { text: 'Walk-forward (blind)' }), el('td', { text: 'Fit before 2025-06-01, tested on the ' + f.wf_n + ' newer tokens: RMSE ' + (f.wf_rmse === null ? 'n/a' : f.wf_rmse.toFixed(2)) + ' vs ' + (f.wf_starter_rmse === null ? 'n/a' : f.wf_starter_rmse.toFixed(2)) + ' for the flat rule.' })),
        el('tr', null, el('td', { text: 'Why the tilts are small' }), el('td', { text: 'In the comps, seven-day growth correlates r = −0.15 with the market-cap ratio and age r = 0.00: neither predicts a multiple, so both tilts are capped and can never dominate size.' })),
        el('tr', null, el('td', { text: 'Rank ranges' }), el('td', { text: 'Each rank carries its 10th–90th percentile over 200 bootstrap refits of the comps (seeded, reproducible). Wide bands are the honest width of a fitted value.' }))
      )),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses 365 days. Implied value is an estimate, not a price.' })
    );
  }

  function coveragePanel() {
    var c = DATA.coverage;
    var reasons = {};
    DATA.flagged.forEach(function (r) { reasons[r.flag] = (reasons[r.flag] || 0) + 1; });
    var reasonText = Object.keys(reasons).sort().map(function (k) { return k + ' ' + reasons[k]; }).join(' · ');
    return el('section', { class: 'panel coverage' },
      el('h2', { text: 'Coverage: every protocol, accounted for' }),
      el('div', { class: 'funnel' },
        el('div', { class: 'step' }, el('b', { text: String(c.scanned) }), el('span', { text: 'scanned (TVL ≥ $5M)' })),
        el('div', { class: 'step' }, el('b', { text: String(c.pre_token) }), el('span', { text: 'record no token' })),
        el('div', { class: 'step' }, el('b', { text: String(c.clean) }), el('span', { text: 'clean launch candidates' })),
        el('div', { class: 'step' }, el('b', { text: String(c.flagged) }), el('span', { text: 'flagged products' })),
        el('div', { class: 'step' }, el('b', { text: c.watchlist + ' / ' + c.watchlist }), el('span', { text: 'watchlist covered' }))
      ),
      el('p', { class: 'sub', text: 'Flagged by reason: ' + reasonText + '. The live-token protocols (top 24 by market cap) are set aside with their market caps shown, never mixed into the ranking.' }),
      el('p', { class: 'sub', text: 'The watchlist is the floor, never the ceiling: the board ranks all ' + c.pre_token + ' pre-token protocols, including the ' + DATA.rows.filter(function (r) { return !r.launch_flag && r.tvl_usd < DATA.floor_usd; }).length + ' clean ones below the $50M floor by TVL and every flagged product, so nothing the snapshot records is left out.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.rows.length + ' · range ' + row.rank_lo + '–' + row.rank_hi }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    );
    dialog.appendChild(head);
    if (row.launch_flag) {
      dialog.appendChild(el('div', { class: 'detail-section' },
        el('div', { class: 'warnbox', text: 'Flagged as ' + row.launch_flag + ': ' + flagReason(row, row.launch_flag) + ' Verdict: SKIP.' })
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted base (TVL × curve)' }), el('b', { class: 'num', text: fmtUsd(row.base_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: '×' + row.category_multiplier })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth × maturity tilts' }), el('b', { class: 'num', text: '×' + row.growth_multiplier + ' × ' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Rank range (200 refits)' }), el('b', { class: 'num', text: row.rank_lo + '–' + row.rank_hi }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics' }),
      el('div', { class: 'econline' },
        el('span', null, 'Capital ', el('b', { text: '$' + row.econ.capital_usd })),
        el('span', null, 'Out of pocket ', el('b', { text: '$' + row.econ.total_cost_usd + ' over ' + row.econ.hold_days + ' days' })),
        el('span', null, 'Break-even ', el('b', { text: '$' + row.econ.break_even_usd + ' (' + fmtShare(row.econ.break_even_share) + ' of implied)' })),
        el('span', null, 'Pool at 7.5% ', el('b', { text: '$' + row.econ.pool_75_usd.toLocaleString('en-US') })),
        el('span', null, 'Cost per active hour ', el('b', { text: '$' + row.econ.cost_per_hour_usd }))
      ),
      el('p', { class: 'sub', text: 'Verdict: ' + row.econ.verdict + ' — ' + row.econ.verdict_reason })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(howPanel());
    shell.appendChild(controls());
    if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'flagged') shell.appendChild(flaggedTable());
    else shell.appendChild(boardTable());
    shell.appendChild(modelPanel());
    shell.appendChild(coveragePanel());
    shell.appendChild(el('footer', { class: 'foot' },
      el('p', { text: 'Source: DefiLlama protocol index, fetched ' + DATA.as_of + '. Implied values are this radar’s model, not a price and not a promise that any protocol issues a token.' }),
      el('p', { text: 'Model ' + DATA.model_version + ': comps curve fitted at run time on the snapshot’s traded tokens, validated leave-one-out and walk-forward. Dashboard renders with no network.' })
    ));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
