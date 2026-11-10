// Membuat assets/stats.svg dan assets/langs.svg dari GitHub GraphQL API.
// Tanpa dependensi. Jalankan: GH_TOKEN=xxx GH_LOGIN=dodokjr node scripts/generate-stats.mjs
// Mode contoh (tanpa jaringan): node scripts/generate-stats.mjs --demo
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.GH_LOGIN || "dodokjr";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const DEMO = process.argv.includes("--demo");
const OUT = new URL("../assets/", import.meta.url);

// Palet mengikuti Nusa CSS (hasil konversi oklch -> hex)
const C = {
  bg: "#1c1c27", line: "#33344a", text: "#e8e8f0", muted: "#8e8ea3",
  brand: "#8b7cf6", pink: "#e0709a", sky: "#3fb4e8", soft: "#b9b0ff", green: "#4ade80",
};
const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));

const QUERY = `
query($login:String!){
  user(login:$login){
    followers{ totalCount }
    pullRequests{ totalCount }
    issues{ totalCount }
    repositories(ownerAffiliation:OWNER, isFork:false, first:100, orderBy:{field:STARGAZERS, direction:DESC}){
      totalCount
      nodes{ stargazerCount languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } }
    }
    contributionsCollection{
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
    }
  }
}`;

async function fetchData() {
  if (DEMO) return null;
  if (!TOKEN) throw new Error("GH_TOKEN / GITHUB_TOKEN belum di-set");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-stats" },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors || !json.data?.user) {
    throw new Error("GitHub API error: " + JSON.stringify(json.errors || json).slice(0, 400));
  }
  return json.data.user;
}

function streaks(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays).sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--; // hari ini belum tentu sudah ada kontribusi
  let current = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  return { current, longest };
}

function shell(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.brand}"/><stop offset="0.55" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.sky}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#5b4fd6" stop-opacity="0.45"/><stop offset="1" stop-color="#5b4fd6" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="r"><rect width="${w}" height="${h}" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="${w}" height="${h}" fill="${C.bg}"/>
    <ellipse cx="${w - 40}" cy="10" rx="220" ry="120" fill="url(#glow)"/>
    <text x="28" y="40" font-family="${FONT}" font-size="18" font-weight="800" fill="url(#brand)">${esc(title)}</text>
    ${body}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="16" fill="none" stroke="${C.line}"/>
</svg>
`;
}

function renderStats(d) {
  const cc = d?.contributionsCollection;
  const repos = d?.repositories;
  const stars = repos ? repos.nodes.reduce((a, r) => a + r.stargazerCount, 0) : null;
  const commits = cc ? cc.totalCommitContributions + cc.restrictedContributionsCount : null;
  const st = cc ? streaks(cc.contributionCalendar.weeks) : { current: null, longest: null };
  const items = [
    ["★", "Total Stars", stars, C.pink],
    ["⌥", "Commits (1 thn)", commits, C.brand],
    ["⇄", "Pull Requests", d?.pullRequests.totalCount, C.sky],
    ["!", "Issues", d?.issues.totalCount, C.pink],
    ["▣", "Repositori", repos?.totalCount, C.brand],
    ["♥", "Followers", d?.followers.totalCount, C.sky],
  ];
  let body = "";
  items.forEach(([ic, label, val, col], i) => {
    const x = 28 + (i % 2) * 280, y = 78 + Math.floor(i / 2) * 36;
    body += `<circle cx="${x + 9}" cy="${y - 5}" r="11" fill="${col}" fill-opacity="0.16"/>
    <text x="${x + 9}" y="${y - 1}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="${col}">${ic}</text>
    <text x="${x + 30}" y="${y}" font-family="${FONT}" font-size="14" fill="${C.muted}">${label}</text>
    <text x="${x + 250}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.text}">${num(val)}</text>`;
  });
  body += `<rect x="28" y="196" width="544" height="1" fill="${C.line}"/>`;
  const cols = [
    [num(cc?.contributionCalendar.totalContributions), "Kontribusi (1 thn)", C.soft],
    [num(st.current), "Streak Saat Ini (hari)", C.pink],
    [num(st.longest), "Streak Terpanjang (hari)", C.sky],
  ];
  cols.forEach(([v, l, col], i) => {
    const cx = 28 + 544 / 6 + (i * 544) / 3;
    body += `<text x="${cx}" y="232" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" fill="${col}">${v}</text>
    <text x="${cx}" y="254" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${C.muted}">${l}</text>`;
  });
  return shell(600, 280, `GitHub Stats · ${LOGIN}`, body);
}

function renderLangs(d) {
  const FALLBACK = [C.brand, C.pink, C.sky, "#4ade80", "#fbbf24", "#fb923c"];
  const totals = new Map();
  for (const r of d?.repositories.nodes ?? []) {
    for (const e of r.languages.edges) {
      const cur = totals.get(e.node.name) || { size: 0, color: e.node.color };
      cur.size += e.size;
      totals.set(e.node.name, cur);
    }
  }
  const list = [...totals.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 6);
  let body = "";
  if (!list.length) {
    body = `<text x="300" y="150" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${C.muted}">Menunggu data pertama dari GitHub Actions…</text>`;
    return shell(600, 280, "Bahasa Terbanyak", body);
  }
  const sum = list.reduce((a, [, v]) => a + v.size, 0);
  const barX = 28, barW = 544;
  body += `<clipPath id="bar"><rect x="${barX}" y="62" width="${barW}" height="12" rx="6"/></clipPath><g clip-path="url(#bar)">`;
  let x = barX;
  list.forEach(([, v], i) => {
    const w = (v.size / sum) * barW;
    body += `<rect x="${x.toFixed(2)}" y="62" width="${(w + 0.5).toFixed(2)}" height="12" fill="${v.color || FALLBACK[i % 6]}"/>`;
    x += w;
  });
  body += `</g>`;
  list.forEach(([name, v], i) => {
    const col = v.color || FALLBACK[i % 6];
    const cx = 28 + (i % 2) * 280, cy = 110 + Math.floor(i / 2) * 50;
    const pct = (v.size / sum) * 100;
    body += `<circle cx="${cx + 6}" cy="${cy - 5}" r="5" fill="${col}"/>
    <text x="${cx + 20}" y="${cy}" font-family="${FONT}" font-size="14" font-weight="600" fill="${C.text}">${esc(name)}</text>
    <text x="${cx + 250}" y="${cy}" text-anchor="end" font-family="${FONT}" font-size="14" fill="${C.muted}">${pct.toFixed(1)}%</text>
    <rect x="${cx}" y="${cy + 10}" width="250" height="5" rx="2.5" fill="${C.line}"/>
    <rect x="${cx}" y="${cy + 10}" width="${Math.max(3, (pct / 100) * 250).toFixed(1)}" height="5" rx="2.5" fill="${col}"/>`;
  });
  return shell(600, 280, "Bahasa Terbanyak", body);
}

const data = await fetchData();
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("stats.svg", OUT), renderStats(data));
writeFileSync(new URL("langs.svg", OUT), renderLangs(data));
console.log(DEMO ? "Selesai (mode contoh)." : `Selesai untuk ${LOGIN}.`);
