/**
 * lib/savingsReportPdf.ts
 *
 * downloadSavingsReport  → Print / Save PDF
 *   • Web:    Opens browser print dialog  →  user picks "Save as PDF"
 *   • Native: Opens system Print UI  →  user taps "Save to Files"
 *
 * shareSavingsReport     → Share
 *   • Web:    navigator.share() with a real HTML file blob (opens/prints
 *             perfectly in any browser).  Falls back to a direct download
 *             if the browser / OS doesn't support file sharing.
 *   • Native: Generates a PDF with expo-print then opens the OS share sheet
 *             (WhatsApp, Email, AirDrop, Google Drive, …).
 *
 * Install once:
 *   npx expo install expo-print expo-sharing
 */

import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform }  from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  count: number;
  total: number;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  label: string;
  total: number;
}

export interface SubscriptionItem {
  id: number;
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'WEEKLY';
  nextBilling: string;
  category: string;
  color?: string;
  isPaused?: boolean;
  daysUntilBilling?: number;
}

export interface DashboardData {
  monthlyTotal: number;
  yearlyTotal: number;
  activeSubscriptions: number;
  activeTrackers: number;
  totalSavings: number;
  categoryBreakdown: CategoryBreakdown[];
  upcomingBillings: SubscriptionItem[];
  monthlyTrend: MonthlyTrend[];
}

export interface PlatformInsights {
  avgMonthlySpend: number;
  avgSubscriptionsPerUser: number;
  totalActiveUsers: number;
}

export interface GenerateReportOptions {
  dashboard: DashboardData;
  subscriptions: SubscriptionItem[];
  insights?: PlatformInsights | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const eur = (n: number, dp = 2) =>
  '€' + Number(n).toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const cap = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

const cycleSuffix = (c: string) =>
  ({ MONTHLY: 'mo', YEARLY: 'yr', WEEKLY: 'wk' }[c] ?? c.toLowerCase());

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

const today = () =>
  new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

const year = () => new Date().getFullYear();

const CAT_COLORS: Record<string, string> = {
  Streaming: '#7c3aed', Music: '#ec4899', Cloud: '#06b6d4',
  Gaming: '#10b981', Software: '#f59e0b', Fitness: '#ef4444',
  Education: '#3b82f6', Other: '#64748b',
};
const catColor = (name: string) => CAT_COLORS[cap(name)] ?? '#64748b';

// ── SVG bar chart ─────────────────────────────────────────────────────────────

function trendChart(trend: MonthlyTrend[]): string {
  if (!trend?.length) return '';
  const W = 52, GAP = 10, H = 110;
  const max = Math.max(...trend.map(t => Number(t.total)), 1);
  const totalW = trend.length * (W + GAP) + GAP;

  const bars = trend.map((t, i) => {
    const val  = Number(t.total);
    const barH = Math.max(4, (val / max) * H);
    const x    = GAP + i * (W + GAP);
    const y    = H - barH;
    const last = i === trend.length - 1;
    return `
      <rect x="${x}" y="${y}" width="${W}" height="${barH}"
            fill="${last ? 'url(#g)' : '#1e293b'}" rx="5"/>
      <text x="${x + W / 2}" y="${H + 16}" fill="#475569"
            font-size="11" text-anchor="middle" font-family="Inter,sans-serif">${t.label}</text>
      <text x="${x + W / 2}" y="${y - 6}" fill="${last ? '#a78bfa' : '#475569'}"
            font-size="10" text-anchor="middle" font-family="Inter,sans-serif">
        ${val < 1000 ? val.toFixed(0) : (val / 1000).toFixed(1) + 'k'}
      </text>`;
  }).join('');

  return `
    <svg width="${totalW}" height="${H + 30}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      ${bars}
    </svg>`;
}

// ── Category bars ─────────────────────────────────────────────────────────────

function categoryBars(breakdown: CategoryBreakdown[]): string {
  if (!breakdown?.length) return '<p style="color:#475569">No data yet.</p>';
  const max = Math.max(...breakdown.map(c => Number(c.total)), 1);
  return breakdown.map(c => {
    const pct = Math.min(100, (Number(c.total) / max) * 100);
    const col = catColor(c.category);
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="color:#cbd5e1;font-size:13px;font-weight:600">
            ${c.category || 'Other'}
          </span>
          <span style="color:#f1f5f9;font-size:13px;font-weight:700">
            ${eur(Number(c.total))}/mo
            <span style="color:#475569;font-size:11px;font-weight:400">
              &nbsp;(${c.count} sub${Number(c.count) !== 1 ? 's' : ''})
            </span>
          </span>
        </div>
        <div style="background:#1e293b;border-radius:99px;height:7px;overflow:hidden">
          <div style="background:${col};width:${pct}%;height:7px;border-radius:99px"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Subscription table ────────────────────────────────────────────────────────

function subsTable(subs: SubscriptionItem[]): string {
  if (!subs?.length) return `
    <tr><td colspan="4" style="text-align:center;color:#475569;padding:20px">
      No subscriptions yet.
    </td></tr>`;

  return subs.map((s, i) => {
    const bg  = i % 2 === 0 ? '#0f172a' : '#0a0f1e';
    const col = s.color || catColor(s.category);
    const badge = s.isPaused
      ? `<span style="background:#1e293b;color:#64748b;padding:2px 8px;border-radius:99px;font-size:10px">Paused</span>`
      : `<span style="background:${col}22;color:${col};padding:2px 8px;border-radius:99px;font-size:10px">${s.category || '—'}</span>`;
    return `
      <tr style="background:${bg}">
        <td style="padding:10px 14px;color:#f1f5f9;font-size:12px;font-weight:600">${s.name}</td>
        <td style="padding:10px 14px;text-align:right;white-space:nowrap">
          <span style="color:#a78bfa;font-size:13px;font-weight:700">${eur(Number(s.amount))}</span>
          <span style="color:#475569;font-size:10px">/${cycleSuffix(s.billingCycle)}</span>
        </td>
        <td style="padding:10px 14px;text-align:center">${badge}</td>
        <td style="padding:10px 14px;text-align:right;color:#64748b;font-size:11px;white-space:nowrap">
          ${fmtDate(s.nextBilling)}
        </td>
      </tr>`;
  }).join('');
}

// ── Upcoming billings ─────────────────────────────────────────────────────────

function upcomingList(upcoming: SubscriptionItem[]): string {
  if (!upcoming?.length) return '<p style="color:#475569;font-size:13px">No charges in the next 7 days.</p>';
  return upcoming.slice(0, 5).map(s => `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:11px 0;border-bottom:1px solid #1e293b">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:9px;height:9px;border-radius:50%;
                    background:${s.color || '#7c3aed'};flex-shrink:0"></div>
        <span style="color:#e2e8f0;font-size:13px">${s.name}</span>
      </div>
      <div>
        <span style="color:#f1f5f9;font-weight:700;font-size:13px">${eur(Number(s.amount))}</span>
        <span style="color:#475569;font-size:11px;margin-left:8px">${fmtDate(s.nextBilling)}</span>
      </div>
    </div>`).join('');
}

// ── Platform benchmark ────────────────────────────────────────────────────────

function benchmarkSection(monthly: number, subCount: number, ins: PlatformInsights): string {
  const avg  = Number(ins.avgMonthlySpend);
  const diff = monthly - avg;
  const col  = diff > 0 ? '#ef4444' : '#10b981';
  const lbl  = diff > 0 ? 'above avg' : 'below avg';
  const sign = diff >= 0 ? '+' : '';
  return `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px;margin-top:20px">
      <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                  letter-spacing:2px;margin-bottom:16px">📊 How You Compare to Other Users</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
          <div style="color:#f1f5f9;font-size:22px;font-weight:800">${eur(monthly)}</div>
          <div style="color:#475569;font-size:11px;margin-top:4px">Your monthly</div>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
          <div style="color:#94a3b8;font-size:22px;font-weight:800">${eur(avg)}</div>
          <div style="color:#475569;font-size:11px;margin-top:4px">Platform avg</div>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
          <div style="color:${col};font-size:22px;font-weight:800">${sign}${eur(Math.abs(diff))}</div>
          <div style="color:#475569;font-size:11px;margin-top:4px">${lbl}</div>
        </div>
      </div>
      <div style="color:#475569;font-size:12px;text-align:center">
        You have <strong style="color:#e2e8f0">${subCount}</strong> active subscriptions
        · platform average is <strong style="color:#e2e8f0">${Number(ins.avgSubscriptionsPerUser).toFixed(1)}</strong>
        · data from <strong style="color:#e2e8f0">${Number(ins.totalActiveUsers).toLocaleString()}</strong> users
      </div>
    </div>`;
}

// ── Tips ──────────────────────────────────────────────────────────────────────

const TIPS = [
  { icon: '🔍', title: 'Audit streaming services',   desc: 'Rotate subscriptions — watch one, pause the rest. Save ~€15/month.' },
  { icon: '📆', title: 'Switch to yearly billing',   desc: 'Most services give 2 months free when you pay annually.' },
  { icon: '🎯', title: 'Track before you buy',       desc: 'Paste any product URL — SubTrackr tells you if the price is at its lowest.' },
  { icon: '✉️', title: 'Use the Email Drafter',      desc: 'Generate a professional cancellation or negotiation email in one tap.' },
];

function tipsHtml(monthly: number): string {
  return TIPS.map(t => `
    <div style="display:flex;gap:14px;padding:14px;background:rgba(124,58,237,0.06);
                border-left:3px solid #7c3aed;border-radius:0 10px 10px 0;margin-bottom:12px">
      <span style="font-size:20px;flex-shrink:0">${t.icon}</span>
      <div>
        <div style="color:#e2e8f0;font-size:13px;font-weight:600">${t.title}</div>
        <div style="color:#64748b;font-size:12px;margin-top:3px;line-height:1.5">${t.desc}</div>
      </div>
    </div>`).join('') + `
    <div style="display:flex;gap:14px;padding:14px;background:rgba(236,72,153,0.06);
                border-left:3px solid #ec4899;border-radius:0 10px 10px 0;margin-bottom:12px">
      <span style="font-size:20px;flex-shrink:0">💰</span>
      <div>
        <div style="color:#e2e8f0;font-size:13px;font-weight:600">You're spending ${eur(monthly)}/month on subscriptions</div>
        <div style="color:#64748b;font-size:12px;margin-top:3px;line-height:1.5">
          That's ${eur(monthly * 12)} a year. Is it all within your budget?
        </div>
      </div>
    </div>`;
}

// ── Full HTML builder ─────────────────────────────────────────────────────────

function buildHtml(opts: GenerateReportOptions): string {
  const { dashboard, subscriptions, insights } = opts;
  const monthly  = Number(dashboard?.monthlyTotal  ?? 0);
  const yearly   = Number(dashboard?.yearlyTotal   ?? 0);
  const savings  = Number(dashboard?.totalSavings  ?? 0);
  const subs     = dashboard?.activeSubscriptions  ?? 0;
  const trackers = dashboard?.activeTrackers       ?? 0;
  const net      = Math.max(0, yearly - savings);
  const savePct  = yearly > 0 ? ((savings / yearly) * 100).toFixed(1) : '0.0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SubTrackr Report ${year()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  *  { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:Inter,-apple-system,sans-serif; background:#020617; color:#f1f5f9 }

  .cover {
    min-height:100vh; padding:56px 52px;
    background:linear-gradient(135deg,#1a0836 0%,#0d1424 55%,#04050d 100%);
    display:flex; flex-direction:column; justify-content:space-between;
    page-break-after:always;
  }
  .logo-row  { display:flex; align-items:center; gap:14px }
  .logo-dot  {
    width:52px; height:52px; border-radius:16px; font-size:24px;
    background:linear-gradient(135deg,#7c3aed,#ec4899);
    display:flex; align-items:center; justify-content:center;
  }
  .logo-name { font-size:22px; font-weight:900; color:#fff }
  .logo-sub  { font-size:12px; color:#64748b; margin-top:2px }
  .hero       { text-align:center; padding:32px 0 }
  .hero-yr    { font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:3px; margin-bottom:14px }
  .hero-title {
    font-size:58px; font-weight:900; line-height:1.05;
    background:linear-gradient(135deg,#a78bfa,#ec4899);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }
  .hero-date { color:#475569; font-size:13px; margin-top:12px }
  .savings-box {
    background:rgba(124,58,237,0.12); border:1px solid rgba(124,58,237,0.3);
    border-radius:20px; padding:36px; text-align:center; margin-top:28px;
  }
  .savings-lbl { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px }
  .savings-val {
    font-size:80px; font-weight:900; line-height:1;
    background:linear-gradient(135deg,#a78bfa,#ec4899);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }
  .savings-sub { color:#475569; font-size:13px; margin-top:10px }
  .cover-kpis { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:22px }
  .cover-kpi  {
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);
    border-radius:14px; padding:18px; text-align:center;
  }
  .ck-val { font-size:26px; font-weight:800; color:#f1f5f9 }
  .ck-lbl { font-size:11px; color:#475569; margin-top:4px }
  .cover-foot {
    display:flex; justify-content:space-between; align-items:center;
    border-top:1px solid rgba(255,255,255,0.06); padding-top:18px;
  }
  .cf-url    { color:#334155; font-size:12px }
  .cf-slogan { color:#7c3aed; font-size:12px; font-weight:600 }

  .page { background:#020617; padding:52px; page-break-after:always }
  .page:last-child { page-break-after:auto }
  .sec-label {
    font-size:11px; font-weight:700; color:#7c3aed;
    text-transform:uppercase; letter-spacing:2px; margin-bottom:20px;
  }
  .card {
    background:#0f172a; border:1px solid #1e293b;
    border-radius:16px; padding:24px; margin-bottom:22px;
  }
  .card-title { font-size:14px; font-weight:700; color:#f1f5f9; margin-bottom:18px }
  .kpi-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px }
  .kpi-box  { border-radius:14px; padding:20px; text-align:center }
  .kpi-val  { font-size:28px; font-weight:800 }
  .kpi-lbl  { font-size:11px; color:#475569; margin-top:5px }
  .row {
    display:flex; justify-content:space-between; align-items:center;
    padding:12px 0; border-bottom:1px solid #1e293b;
  }
  .row:last-child { border-bottom:none }
  .row-lbl { color:#94a3b8; font-size:13px }
  .row-val { font-size:15px; font-weight:700 }
  table  { width:100%; border-collapse:collapse }
  th     {
    background:#1e293b; color:#64748b; font-size:11px;
    font-weight:600; text-transform:uppercase; letter-spacing:.5px;
    padding:10px 14px; text-align:left;
  }
  th:nth-child(2),th:last-child { text-align:right }
  th:nth-child(3) { text-align:center }
  .pgfoot {
    margin-top:36px; padding-top:14px; border-top:1px solid #1e293b;
    display:flex; justify-content:space-between; color:#334155; font-size:11px;
  }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="logo-row">
    <div class="logo-dot">📊</div>
    <div>
      <div class="logo-name">SubTrackr</div>
      <div class="logo-sub">Stop overpaying. Start tracking.</div>
    </div>
  </div>
  <div class="hero">
    <div class="hero-yr">${year()} Annual Savings Report</div>
    <div class="hero-title">Your Savings<br/>Report</div>
    <div class="hero-date">Generated ${today()}</div>
    <div class="savings-box">
      <div class="savings-lbl">Total Saved from Price Drops</div>
      <div class="savings-val">${eur(savings)}</div>
      <div class="savings-sub">
        From tracking ${trackers} product${trackers !== 1 ? 's' : ''}
        ${savings >= 100 ? ' · That\'s ' + Math.floor(savings / 10) + ' coffees saved! ☕' : ''}
      </div>
    </div>
    <div class="cover-kpis">
      <div class="cover-kpi"><div class="ck-val">${subs}</div><div class="ck-lbl">Active subscriptions</div></div>
      <div class="cover-kpi"><div class="ck-val">${eur(monthly)}</div><div class="ck-lbl">Monthly spend</div></div>
      <div class="cover-kpi"><div class="ck-val">${eur(yearly)}</div><div class="ck-lbl">Yearly spend</div></div>
    </div>
  </div>
  <div class="cover-foot">
    <span class="cf-url">subtrackr.app</span>
    <span class="cf-slogan">Stop overpaying. Start tracking.</span>
  </div>
</div>

<!-- PAGE 2: FINANCIAL SUMMARY -->
<div class="page">
  <div class="sec-label">💳 Financial Summary</div>
  <div class="kpi-grid">
    <div class="kpi-box" style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25)">
      <div class="kpi-val" style="color:#818cf8">${eur(monthly)}</div>
      <div class="kpi-lbl">Monthly spend</div>
    </div>
    <div class="kpi-box" style="background:rgba(236,72,153,.1);border:1px solid rgba(236,72,153,.25)">
      <div class="kpi-val" style="color:#f472b6">${eur(yearly)}</div>
      <div class="kpi-lbl">Yearly spend</div>
    </div>
    <div class="kpi-box" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25)">
      <div class="kpi-val" style="color:#34d399">${eur(savings)}</div>
      <div class="kpi-lbl">Saved from price drops</div>
    </div>
    <div class="kpi-box" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25)">
      <div class="kpi-val" style="color:#fbbf24">${eur(net)}</div>
      <div class="kpi-lbl">Net yearly cost</div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Yearly Projection Breakdown</div>
    <div class="row"><span class="row-lbl">Monthly spend</span><span class="row-val" style="color:#818cf8">${eur(monthly)}</span></div>
    <div class="row"><span class="row-lbl">Projected yearly spend</span><span class="row-val" style="color:#f472b6">${eur(monthly * 12)}</span></div>
    <div class="row"><span class="row-lbl">Saved from price drops</span><span class="row-val" style="color:#34d399">− ${eur(savings)}</span></div>
    <div class="row"><span class="row-lbl">Net yearly cost</span><span class="row-val" style="color:#fbbf24">${eur(net)}</span></div>
    <div class="row"><span class="row-lbl">Savings rate</span><span class="row-val" style="color:#34d399">${savePct}%</span></div>
    <div class="row"><span class="row-lbl">Active subscriptions</span><span class="row-val" style="color:#f1f5f9">${subs}</span></div>
    <div class="row"><span class="row-lbl">Products tracked</span><span class="row-val" style="color:#f1f5f9">${trackers}</span></div>
  </div>
  ${insights ? benchmarkSection(monthly, subs, insights) : ''}
  <div class="pgfoot"><span>SubTrackr · subtrackr.app</span><span>Page 2</span></div>
</div>

<!-- PAGE 3: TRENDS -->
<div class="page">
  <div class="sec-label">📈 6-Month Spending Trend</div>
  <div class="card">
    <div class="card-title">Monthly Spend (last 6 months)</div>
    <div style="overflow-x:auto;padding-bottom:4px">${trendChart(dashboard?.monthlyTrend ?? [])}</div>
  </div>
  <div class="card">
    <div class="card-title">Spend by Category</div>
    ${categoryBars(dashboard?.categoryBreakdown ?? [])}
  </div>
  <div class="pgfoot"><span>SubTrackr · subtrackr.app</span><span>Page 3</span></div>
</div>

<!-- PAGE 4: UPCOMING + TIPS -->
<div class="page">
  <div class="sec-label">🗓️ Upcoming Billings (next 7 days)</div>
  <div class="card">
    <div class="card-title">Charges due soon</div>
    ${upcomingList(dashboard?.upcomingBillings ?? [])}
  </div>
  <div class="sec-label" style="margin-top:28px">💡 Money-Saving Tips</div>
  ${tipsHtml(monthly)}
  <div class="pgfoot"><span>SubTrackr · subtrackr.app</span><span>Page 4</span></div>
</div>

<!-- PAGE 5: ALL SUBSCRIPTIONS -->
<div class="page">
  <div class="sec-label">📋 All Subscriptions (${subscriptions?.length ?? 0})</div>
  <div style="border-radius:14px;overflow:hidden;border:1px solid #1e293b">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:center">Category</th>
          <th style="text-align:right">Next Billing</th>
        </tr>
      </thead>
      <tbody>${subsTable(subscriptions ?? [])}</tbody>
    </table>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;
              padding:14px 16px;background:#1e293b;border-radius:0 0 14px 14px;margin-top:-1px">
    <span style="color:#94a3b8;font-size:13px;font-weight:600">
      ${subscriptions?.length ?? 0} subscription${(subscriptions?.length ?? 0) !== 1 ? 's' : ''}
    </span>
    <span style="color:#a78bfa;font-size:14px;font-weight:800">
      Total ${eur(monthly)}/mo · ${eur(yearly)}/yr
    </span>
  </div>
  <div class="pgfoot" style="margin-top:24px">
    <span>SubTrackr · subtrackr.app</span>
    <span>Page 5 — Generated ${today()}</span>
  </div>
</div>

</body>
</html>`;
}

// ── Web helpers ───────────────────────────────────────────────────────────────

/** Opens a hidden iframe and triggers the browser's print dialog. */
function openPrintDialog(html: string): void {
  const old = document.getElementById('__st_print__');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__st_print__';
  Object.assign(iframe.style, {
    position: 'fixed', top: '-9999px', left: '-9999px',
    width: '0', height: '0', border: 'none',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 3000);
  }, 600);
}

/**
 * Share on web:
 *  1. Try navigator.share() with a real HTML file (renders perfectly in any
 *     browser; the recipient can open it and print to PDF).
 *  2. If file sharing isn't supported → try navigator.share() with text only.
 *  3. If navigator.share doesn't exist → download the file directly.
 */
async function webShare(html: string, opts: GenerateReportOptions): Promise<void> {
  const filename = `SubTrackr_Savings_Report_${year()}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

  // Build a short plain-text summary for the share sheet description
  const d       = opts.dashboard;
  const monthly = Number(d?.monthlyTotal  ?? 0);
  const savings = Number(d?.totalSavings  ?? 0);
  const subs    = d?.activeSubscriptions  ?? 0;
  const shareText = [
    `📊 My ${year()} SubTrackr Savings Report`,
    `💳 ${subs} subscription${subs !== 1 ? 's' : ''} · ${eur(monthly)}/mo`,
    savings > 0 ? `🏆 Saved ${eur(savings)} from price drops` : null,
    `📅 Projected yearly spend: ${eur(monthly * 12)}`,
    `Track yours → subtrackr.app`,
  ].filter(Boolean).join('\n');

  // ── Attempt 1: share with file blob ───────────────────────────────────────
  if (typeof navigator?.share === 'function') {
    const file = new File([blob], filename, { type: 'text/html' });
    const canShareFile =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navigator.share({
          title: `SubTrackr ${year()} Savings Report`,
          text:  shareText,
          files: [file],
        });
        return; // ✅ done
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled — do nothing
        // Any other error → fall through to text-only share
      }
    }

    // ── Attempt 2: share text only (no file) ────────────────────────────────
    try {
      await navigator.share({
        title: `SubTrackr ${year()} Savings Report`,
        text:  shareText,
        url:   'https://subtrackr.app',
      });
      return; // ✅ done
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      // Fall through to download
    }
  }

  // ── Attempt 3: download the HTML report ───────────────────────────────────
  // This is the universal fallback. The downloaded file opens in any browser
  // and can be printed to PDF with one click.
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), {
    href: url, download: filename,
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Print / Save PDF
 * Opens the system print dialog on both web and native.
 * The user can tap "Save as PDF" / "Save to Files" from there.
 */
export async function downloadSavingsReport(opts: GenerateReportOptions): Promise<void> {
  const html = buildHtml(opts);

  if (Platform.OS === 'web') {
    openPrintDialog(html);
    return;
  }

  // Native: expo-print opens the system Print UI
  try {
    await Print.printAsync({ html });
  } catch (err) {
    console.error('[PDF] printAsync failed:', err);
    throw err;
  }
}

/**
 * Share PDF / Report
 * • Web:    Shares the HTML report file via navigator.share (3-level fallback)
 * • Native: Generates a real PDF with expo-print then opens the OS share sheet
 *           (WhatsApp, Email, AirDrop, Google Drive, Telegram, …)
 */
export async function shareSavingsReport(opts: GenerateReportOptions): Promise<void> {
  const html = buildHtml(opts);

  if (Platform.OS === 'web') {
    await webShare(html, opts);
    return;
  }

  // Native: printToFileAsync → Sharing.shareAsync
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType:    'application/pdf',
        dialogTitle: `Share SubTrackr Report ${year()}`,
        UTI:         'com.adobe.pdf',
      });
    } else {
      // Sharing not available on this device — fall back to print dialog
      await Print.printAsync({ html });
    }
  } catch (err) {
    console.error('[PDF] shareSavingsReport failed:', err);
    throw err;
  }
}