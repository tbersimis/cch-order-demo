'use strict';

/*
 * Coca-Cola HBC order line demo for an AudioCodes Live Hub AI agent.
 *
 * Agent tools (all POST with a JSON body):
 *   POST /api/customers/lookup   { account_number | business_name }
 *   POST /api/products/search    { query, category }
 *   POST /api/orders             { account_number, items, requested_delivery, notes }
 *   POST /api/orders/status      { order_id | account_number }
 *
 * Back office and website:
 *   GET    /api/orders            list orders, newest first
 *   PATCH  /api/orders/:id        { status: new | confirmed | out_for_delivery | delivered }
 *   DELETE /api/orders            reset to the demo history (?mode=empty clears everything);
 *                                 needs X-Admin-Token if ADMIN_TOKEN is set
 *   GET    /api/catalog           products and demo customers
 *   GET    /healthz
 *
 * Environment: PORT, DATA_DIR, SEED_DEMO (default true: start with ~2 weeks of demo orders), API_KEY (optional, header X-API-Key on agent tools),
 *              ADMIN_TOKEN (optional, header X-Admin-Token on status changes / clear).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PRODUCTS, CUSTOMERS } = require('./catalog');

const PORT = parseInt(process.env.PORT || '8080', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');
const API_KEY = process.env.API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TZ = 'Europe/Athens';
const MAX_ORDERS = 500;
const STATUSES = ['new', 'confirmed', 'out_for_delivery', 'delivered'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- storage ----------
let orders = [];
function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(parsed)) orders = parsed;
    }
  } catch (err) {
    console.error('Could not load orders, starting empty:', err.message);
  }
}
function save() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('Could not save orders:', err.message);
  }
}

// ---------- text helpers ----------
// Live Hub fills {{placeholders}}; an optional value the model left out can arrive empty or raw.
function clean(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  return /^\{\{.*\}\}$/.test(s) || /^\{[a-z_]+\}$/i.test(s) ? '' : s;
}
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .trim();
}
const STOP = new Set(['x', 'of', 'the', 'a', 'and', 'cases', 'case', 'please', 'κιβωτια', 'κιβωτιο', 'και', 'απο', 'με']);
function tokens(s) {
  return norm(s).split(' ').filter((t) => t && !STOP.has(t));
}

// Pack hints spoken by callers, mapped to words in the pack description.
const PACK_HINTS = [
  [/(^| )(can|cans|κουτακι|κουτακια|κουτι)( |$)/, 'can'],
  [/(^| )(glass|γυαλινο|γυαλινα|γυαλι)( |$)/, 'glass'],
  [/(1\.5|1,5|ενα μισι|εναμισι|ενα και μισο|one and a half)/, '1.5l'],
  [/(^| )(500|500ml|half litre|μισολιτρο|μισολιτρα)( |$)/, '500ml'],
  [/(^| )(330|330ml)( |$)/, '330ml'],
  [/(^| )(250|250ml)( |$)/, '250ml'],
];

// Variants: if the caller names one, products of another variant drop down the list.
const VARIANTS = [
  [/(^| )(zero|ζιρο|no sugar|χωρις ζαχαρη)( |$)/, /zero/],
  [/(^| )(light|diet|λαιτ)( |$)/, /light/],
  [/(^| )(ultra|αλτρα)( |$)/, /ultra/],
];

function productHaystack(p) {
  return norm([p.sku, p.brand, p.name, p.pack, p.category, p.keywords].join(' '));
}
function scoreProduct(p, query) {
  const q = norm(query);
  if (!q) return 0;
  if (norm(p.sku) === q) return 100;
  const hay = productHaystack(p);
  const hayTokens = new Set(hay.split(' '));
  let score = 0;
  for (const t of tokens(query)) {
    if (hayTokens.has(t)) score += 3;
    else if (t.length >= 4 && hay.includes(t)) score += 2;
  }
  const brand = norm(p.brand);
  if (tokens(query).some((t) => t.length >= 3 && brand.includes(t))) score += 2;
  const nameText = norm(p.name);
  for (const [re, variant] of VARIANTS) {
    const asked = re.test(q);
    const isVariant = variant.test(nameText);
    if (asked && isVariant) score += 4;
    else if (asked && !isVariant) score -= 4;
    else if (!asked && isVariant) score -= 1;
  }
  const packText = norm(p.pack);
  for (const [re, word] of PACK_HINTS) {
    if (re.test(q)) score += packText.includes(word) ? 4 : -3;
  }
  return score;
}
function searchProducts(query, category, limit = 6, minScore = 3) {
  let list = PRODUCTS;
  const cat = norm(category);
  if (cat) list = list.filter((p) => norm(p.category).includes(cat) || cat.includes(norm(p.category)));
  if (!clean(query)) return list.slice(0, limit).map((p) => ({ p, score: 1 }));
  return list
    .map((p) => ({ p, score: scoreProduct(p, query) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
function publicProduct(p) {
  return { sku: p.sku, name: p.name, pack: p.pack, category: p.category, price_per_case_eur: p.price };
}

function findCustomer(account, business) {
  const acc = String(account || '').replace(/\D/g, '');
  if (acc) {
    const c = CUSTOMERS.find((x) => x.account === acc);
    if (c) return c;
  }
  const b = clean(business);
  if (b) {
    let best = null;
    let bestScore = 0;
    for (const c of CUSTOMERS) {
      const hay = norm(c.name + ' ' + c.area + ' ' + c.keywords);
      const s = tokens(b).reduce((n, t) => n + (t.length >= 3 && hay.includes(t) ? 1 : 0), 0);
      if (s > bestScore) { best = c; bestScore = s; }
    }
    if (best) return best;
  }
  return null;
}

// ---------- dates (Europe/Athens) ----------
function athensToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(parts + 'T12:00:00Z');
}
function iso(d) { return d.toISOString().slice(0, 10); }
function spoken(d) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
function nextDeliveryDate(customer, fromDate) {
  const d = new Date((fromDate || athensToday()).getTime());
  for (let i = 1; i <= 14; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (customer.delivery_days.includes(DAY_NAMES[d.getUTCDay()])) return new Date(d.getTime());
  }
  return d;
}
// Accepts "2026-11-12", "tomorrow", "Friday" / "next Friday" (English, as the agent is told to send).
function parseRequestedDate(text) {
  const s = clean(text).toLowerCase();
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    return isNaN(d) ? null : d;
  }
  const today = athensToday();
  if (/tomorrow/.test(s)) { const d = new Date(today.getTime()); d.setUTCDate(d.getUTCDate() + 1); return d; }
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = names.findIndex((n) => s.includes(n) || s.includes(n.slice(0, 3) + ' '));
  if (idx >= 0) {
    const d = new Date(today.getTime());
    do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== idx);
    return d;
  }
  return null;
}

// ---------- order items ----------
// Accepts "CC-ZERO-330C:5, AVRA-1500P:10" (preferred) or "5 x Coca-Cola Zero cans; 10 AVRA 1.5L".
function parseItems(raw) {
  let pieces = [];
  if (Array.isArray(raw)) pieces = raw.map(String);
  else pieces = String(raw || '').split(/[;,\n]+/);

  const lines = new Map();
  const unmatched = [];
  for (let piece of pieces) {
    piece = clean(piece);
    if (!piece) continue;
    let qty = null;
    let ref = piece;

    let m = piece.match(/^(.+?)\s*(?:[:=×*]|\bx\b)\s*(\d+)\s*(?:cases?|κιβώτια|κιβώτιο)?$/i);
    if (m) { ref = m[1]; qty = parseInt(m[2], 10); }
    else if ((m = piece.match(/^(\d+)\s*(?:x|×|cases?\s*(?:of)?|κιβώτια|κιβώτιο)?\s*(.+)$/i))) { qty = parseInt(m[1], 10); ref = m[2]; }

    if (!qty || qty < 1) { unmatched.push(piece); continue; }
    if (qty > 500) qty = 500;

    const bySku = PRODUCTS.find((p) => norm(p.sku) === norm(ref));
    // Free text needs a clear match (a brand or product name), not just a category word.
    const best = bySku ? { p: bySku } : searchProducts(ref, '', 1, 5)[0];
    if (!best) { unmatched.push(piece); continue; }

    const prev = lines.get(best.p.sku);
    lines.set(best.p.sku, { product: best.p, qty: (prev ? prev.qty : 0) + qty });
  }

  const items = [...lines.values()].map(({ product: p, qty }) => ({
    sku: p.sku,
    name: p.name,
    pack: p.pack,
    category: p.category,
    cases: qty,
    price_per_case_eur: p.price,
    line_total_eur: Math.round(p.price * qty * 100) / 100,
  }));
  return { items, unmatched };
}


// ---------- demo history ----------
// A realistic order history, regenerated whenever the server starts with no orders
// (Render's free plan wipes the disk when the service sleeps). Dates are relative to today.
const SEED_DEMO = (process.env.SEED_DEMO || 'true') !== 'false';
const SEED_DAYS = 14;

// Typical baskets per business type: [sku, min cases, max cases]
const BASKETS = {
  'Café': [['CC-ORIG-250G', 2, 4], ['CC-ZERO-330C', 1, 3], ['AMITA-ORA-1L', 2, 5], ['SCH-TONIC-250G', 1, 2], ['AVRA-500P', 3, 6], ['COSTA-BEANS-1K', 1, 1], ['FUZE-LEMON-500P', 1, 3]],
  'Mini market': [['CC-ORIG-330C', 4, 8], ['CC-ZERO-330C', 3, 6], ['CC-ORIG-1500P', 4, 10], ['AVRA-1500P', 8, 20], ['MONSTER-500C', 2, 4], ['TSAKIRIS-SALT-90', 2, 4], ['FANTA-ORA-330C', 2, 4], ['AMITA-4F-1L', 1, 3]],
  'Taverna': [['CC-ORIG-250G', 3, 6], ['SCH-SODA-250G', 1, 3], ['AVRA-1500P', 10, 20], ['FANTA-LEM-330C', 1, 3], ['PLOMARI-700', 1, 2], ['AMITA-ORA-1L', 1, 2]],
  'Kiosk': [['CC-ORIG-330C', 3, 6], ['CC-ZERO-500P', 2, 4], ['AVRA-500P', 4, 8], ['MONSTER-500C', 2, 5], ['MONSTER-ULTRA-500C', 1, 3], ['TSAKIRIS-SALT-90', 1, 3], ['SPRITE-330C', 1, 2], ['POWERADE-500P', 1, 2]],
  'Bar': [['3C-TONIC-200G', 2, 5], ['3C-PINK-200G', 1, 3], ['3C-GINGER-200G', 1, 3], ['SCH-SODA-250G', 1, 2], ['APEROL-700', 1, 2], ['FINLANDIA-700', 1, 2], ['AVRA-500P', 4, 8], ['MONSTER-500C', 1, 2]],
};
const SEED_SOURCES = ['Voice order line', 'Voice order line', 'Voice order line', 'Sales rep visit', 'Customer portal'];
const SEED_NOTES = ['', '', '', 'Deliver before 11:00', 'Use the side entrance', 'Collect empty crates', 'Call on arrival'];

function seededRandom(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

function buildDemoHistory() {
  const today = athensToday();
  const rnd = seededRandom(Number(iso(today).replace(/-/g, '')));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const list = [];
  const used = new Set();

  for (let daysAgo = SEED_DAYS; daysAgo >= 0; daysAgo--) {
    const day = new Date(today.getTime());
    day.setUTCDate(day.getUTCDate() - daysAgo);
    if (day.getUTCDay() === 0) continue; // no orders on Sundays
    const count = daysAgo === 0 ? 2 : between(1, 3);
    for (let n = 0; n < count; n++) {
      const c = pick(CUSTOMERS);
      const basket = BASKETS[c.type] || BASKETS['Mini market'];
      const lines = basket.filter(() => rnd() < 0.6);
      if (lines.length < 2) lines.push(...basket.slice(0, 2 - lines.length));
      const items = [...new Map(lines.map((l) => [l[0], l])).values()].map(([sku, lo, hi]) => {
        const p = PRODUCTS.find((x) => x.sku === sku);
        const cases = between(lo, hi);
        return { sku, name: p.name, pack: p.pack, category: p.category, cases, price_per_case_eur: p.price,
                 line_total_eur: Math.round(p.price * cases * 100) / 100 };
      });
      const created = new Date(day.getTime());
      created.setUTCHours(5 + between(0, 9), between(0, 59), between(0, 59), 0); // 07:00-16:59 Athens
      if (daysAgo === 0 && created > new Date()) created.setTime(Date.now() - between(20, 120) * 60000);
      const delivery = nextDeliveryDate(c, day);
      const todayIso = iso(today);
      const deliveryIso = iso(delivery);
      let status = 'delivered';
      if (deliveryIso > todayIso) status = daysAgo === 0 ? (n === 0 ? 'new' : 'confirmed') : 'confirmed';
      else if (deliveryIso === todayIso) status = 'out_for_delivery';
      let id;
      do { id = 'CCH-' + (10000 + Math.floor(rnd() * 90000)); } while (used.has(id));
      used.add(id);
      const totalCases = items.reduce((t, i) => t + i.cases, 0);
      list.push({
        id, account_number: c.account, business_name: c.name, business_type: c.type, area: c.area,
        items, unmatched: [], total_cases: totalCases,
        total_eur: Math.round(items.reduce((t, i) => t + i.line_total_eur, 0) * 100) / 100,
        delivery_date: deliveryIso, requested_delivery: '', notes: pick(SEED_NOTES), status,
        source: pick(SEED_SOURCES), demo_history: true,
        created_at: created.toISOString(), updated_at: created.toISOString(),
      });
    }
  }
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function orderId() {
  let id;
  do { id = 'CCH-' + (10000 + crypto.randomInt(90000)); } while (orders.some((o) => o.id === id));
  return id;
}

function requireHeader(name, expected) {
  return (req, res, next) => {
    if (!expected || req.get(name) === expected) return next();
    res.status(401).json({ success: false, error: `Missing or wrong ${name} header.` });
  };
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');

app.use('/api', express.text({ type: '*/*', limit: '64kb' }), (req, res, next) => {
  if (typeof req.body === 'string' && req.body.length) {
    try { req.body = JSON.parse(req.body); } catch { return res.status(400).json({ success: false, error: 'Body must be JSON.' }); }
  } else if (typeof req.body !== 'object' || req.body === null) req.body = {};
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Admin-Token');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const agentAuth = requireHeader('X-API-Key', API_KEY);
const adminAuth = requireHeader('X-Admin-Token', ADMIN_TOKEN);

app.get('/healthz', (req, res) => res.json({ ok: true, orders: orders.length }));

app.get('/api/catalog', (req, res) => {
  res.json({
    products: PRODUCTS.map(publicProduct),
    customers: CUSTOMERS.map((c) => ({ account: c.account, name: c.name, type: c.type, area: c.area, delivery_days: c.delivery_days })),
  });
});

app.post('/api/customers/lookup', agentAuth, (req, res) => {
  const c = findCustomer(req.body.account_number, req.body.business_name);
  if (!c) {
    return res.json({
      found: false,
      message: 'No customer found. Ask the caller to repeat their 6-digit customer account number, digit by digit, or the exact business name.',
    });
  }
  const next = nextDeliveryDate(c);
  res.json({
    found: true,
    account_number: c.account,
    business_name: c.name,
    business_type: c.type,
    area: c.area,
    contact_person: c.contact,
    delivery_days: c.delivery_days.join(', '),
    next_delivery_date: iso(next),
    next_delivery_spoken: spoken(next),
  });
});

app.post('/api/products/search', agentAuth, (req, res) => {
  const query = clean(req.body.query);
  const category = clean(req.body.category);
  const results = searchProducts(query, category, 6).map((r) => publicProduct(r.p));
  if (!results.length) {
    const cats = [...new Set(PRODUCTS.map((p) => p.category))];
    return res.json({ found: 0, products: [], message: 'No matching product. Categories available: ' + cats.join(', ') + '.' });
  }
  res.json({ found: results.length, products: results });
});

app.post('/api/orders', agentAuth, (req, res) => {
  const b = req.body || {};
  const customer = findCustomer(b.account_number, b.business_name);
  if (!customer) {
    return res.status(400).json({ success: false, error: 'Unknown customer account. Look up the customer first and pass the 6-digit account_number.' });
  }
  const { items, unmatched } = parseItems(b.items);
  if (!items.length) {
    return res.status(400).json({
      success: false,
      error: 'No valid products in items. Send items as "SKU:cases" pairs separated by commas, for example "CC-ZERO-330C:5, AVRA-1500P:10". Use the product search tool to get SKUs.',
      unmatched,
    });
  }

  const requestedText = clean(b.requested_delivery);
  const requested = parseRequestedDate(requestedText);
  const delivery = requested && requested > athensToday() ? requested : nextDeliveryDate(customer);
  const total = Math.round(items.reduce((n, i) => n + i.line_total_eur, 0) * 100) / 100;
  const totalCases = items.reduce((n, i) => n + i.cases, 0);

  const order = {
    id: orderId(),
    account_number: customer.account,
    business_name: customer.name,
    business_type: customer.type,
    area: customer.area,
    items,
    unmatched,
    total_cases: totalCases,
    total_eur: total,
    delivery_date: iso(delivery),
    requested_delivery: requestedText,
    notes: clean(b.notes),
    status: 'new',
    source: clean(b.source) || 'Voice order line',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  orders.unshift(order);
  if (orders.length > MAX_ORDERS) orders.length = MAX_ORDERS;
  save();
  console.log(`Order ${order.id} for ${order.business_name}: ${totalCases} cases, EUR ${total}`);

  const digits = order.id.replace('CCH-', '').split('').join(' ');
  res.status(201).json({
    success: true,
    order_id: order.id,
    order_id_spoken: 'CCH ' + digits,
    business_name: order.business_name,
    total_cases: totalCases,
    total_eur: total,
    delivery_date: order.delivery_date,
    delivery_spoken: spoken(delivery),
    lines: items.map((i) => `${i.cases} x ${i.name} (${i.pack})`),
    unmatched,
    message: `Order ${order.id} placed for ${order.business_name}: ${totalCases} cases, about EUR ${total.toFixed(2)} excluding VAT, delivery on ${spoken(delivery)}.` +
      (unmatched.length ? ` Not added (no match): ${unmatched.join('; ')}.` : ''),
  });
});

app.post('/api/orders/status', agentAuth, (req, res) => {
  const idRaw = clean(req.body.order_id).replace(/\D/g, '');
  let order = idRaw ? orders.find((o) => o.id === 'CCH-' + idRaw) : null;
  if (!order) {
    const c = findCustomer(req.body.account_number, req.body.business_name);
    if (c) order = orders.find((o) => o.account_number === c.account);
  }
  if (!order) return res.json({ found: false, message: 'No order found for that order number or account.' });
  const labels = { new: 'received', confirmed: 'confirmed', out_for_delivery: 'out for delivery', delivered: 'delivered' };
  res.json({
    found: true,
    order_id: order.id,
    business_name: order.business_name,
    status: labels[order.status],
    delivery_date: order.delivery_date,
    delivery_spoken: spoken(new Date(order.delivery_date + 'T12:00:00Z')),
    total_cases: order.total_cases,
    total_eur: order.total_eur,
    lines: order.items.map((i) => `${i.cases} x ${i.name} (${i.pack})`),
    reorder_items: order.items.map((i) => `${i.sku}:${i.cases}`).join(', '),
  });
});

app.get('/api/orders', (req, res) => {
  res.json({ orders: orders.slice(0, 200), total: orders.length });
});

app.patch('/api/orders/:id', adminAuth, (req, res) => {
  const o = orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ success: false, error: 'Order not found.' });
  const s = clean(req.body.status);
  if (!STATUSES.includes(s)) return res.status(400).json({ success: false, error: 'status must be one of ' + STATUSES.join(', ') });
  o.status = s;
  o.updated_at = new Date().toISOString();
  save();
  res.json({ success: true, order: o });
});

app.delete('/api/orders', adminAuth, (req, res) => {
  const removed = orders.length;
  const empty = req.query.mode === 'empty' || !SEED_DEMO;
  orders = empty ? [] : buildDemoHistory();
  save();
  res.json({ success: true, removed, history: orders.length });
});

app.get('/api/config', (req, res) => res.json({ adminTokenRequired: Boolean(ADMIN_TOKEN), demoHistory: SEED_DEMO }));
app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Unknown endpoint.' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/backoffice', (req, res) => res.redirect(301, '/backoffice/'));

load();
if (!orders.length && SEED_DEMO) {
  orders = buildDemoHistory();
  save();
  console.log(`Created ${orders.length} demo history orders`);
}
app.listen(PORT, () => console.log(`CCH order line demo on :${PORT}`));
