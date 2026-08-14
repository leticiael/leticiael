import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.LOGIN;
const TOKEN = process.env.GITHUB_TOKEN;

const QUERY = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
});

const body = await res.json();
if (body.errors) throw new Error(JSON.stringify(body.errors));
const u = body.data.user;

const commits =
  u.contributionsCollection.totalCommitContributions +
  u.contributionsCollection.restrictedContributionsCount;
const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
const repos = u.repositories.totalCount;
const followers = u.followers.totalCount;

const bytes = new Map();
for (const repo of u.repositories.nodes) {
  for (const e of repo.languages.edges) {
    bytes.set(e.node.name, (bytes.get(e.node.name) ?? 0) + e.size);
  }
}
const total = [...bytes.values()].reduce((a, b) => a + b, 0) || 1;
const langs = [...bytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, size]) => ({ name, pct: (size / total) * 100 }));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const compact = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

const STATS = [
  { value: compact(commits), label: "COMMITS (1Y)" },
  { value: compact(stars), label: "STARS" },
  { value: compact(repos), label: "REPOS" },
  { value: compact(followers), label: "FOLLOWERS" },
];

const statBlocks = STATS.map((s, i) => {
  const x = 44 + i * 152;
  return `      <text x="${x}" y="132" class="sans fg" font-size="40" font-weight="700" letter-spacing="-2">${esc(s.value)}</text>
      <text x="${x}" y="160" class="mono faint" font-size="10" letter-spacing="1.6">${esc(s.label)}</text>`;
}).join("\n");

const OPACITY = [0.95, 0.74, 0.56, 0.4, 0.28];

const langRows = langs
  .map((l, i) => {
    const y = 74 + i * 29;
    const w = Math.max(2, (264 * l.pct) / 100);
    return `      <text x="712" y="${y + 8}" class="mono dim" font-size="11">${esc(l.name)}</text>
      <text x="976" y="${y + 8}" class="mono faint" font-size="10" text-anchor="end">${l.pct.toFixed(1)}%</text>
      <rect x="712" y="${y + 15}" width="264" height="3" rx="1.5" class="track"/>
      <rect x="712" y="${y + 15}" width="${w.toFixed(1)}" height="3" rx="1.5" class="bar" fill-opacity="${OPACITY[i]}"/>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="220" viewBox="0 0 1000 220" fill="none" role="img" aria-label="github stats">
  <title>github stats</title>

  <style>
    .glass { fill: #ffffff; fill-opacity: .035 }
    .edge  { stroke: #ffffff; stroke-opacity: .10 }
    .sheen { stroke: url(#sheenD) }
    .orb   { fill: #ffffff; fill-opacity: .10 }
    .fg    { fill: #f0f6fc }
    .dim   { fill: #8b949e }
    .faint { fill: #6e7681 }
    .track { fill: #ffffff; fill-opacity: .08 }
    .bar   { fill: #f0f6fc }

    @media (prefers-color-scheme: light) {
      .glass { fill: #0d1117; fill-opacity: .025 }
      .edge  { stroke: #0d1117; stroke-opacity: .10 }
      .sheen { stroke: url(#sheenL) }
      .orb   { fill: #0d1117; fill-opacity: .07 }
      .fg    { fill: #0d1117 }
      .dim   { fill: #57606a }
      .faint { fill: #6e7781 }
      .track { fill: #0d1117; fill-opacity: .08 }
      .bar   { fill: #0d1117 }
    }

    @keyframes rise  { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes grow  { from { transform: scaleX(0) } to { transform: scaleX(1) } }

    .card { animation: rise .7s cubic-bezier(.2,.8,.2,1) forwards }
    .dly  { animation-delay: .12s }
    .bar  { transform-box: fill-box; transform-origin: left center; animation: grow 1s cubic-bezier(.2,.8,.2,1) .3s forwards }

    @media (prefers-reduced-motion: reduce) {
      .card, .bar { animation: none }
    }

    .mono { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace }
    .sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif }
  </style>

  <defs>
    <linearGradient id="sheenD" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".22"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sheenL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".9"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="60"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <clipPath id="cA"><rect x="0" y="0" width="660" height="220" rx="26"/></clipPath>
    <clipPath id="cB"><rect x="684" y="0" width="316" height="220" rx="26"/></clipPath>
  </defs>

  <g class="card">
    <g clip-path="url(#cA)">
      <rect x="0" y="0" width="660" height="220" rx="26" class="glass"/>
      <circle cx="60" cy="210" r="120" class="orb" filter="url(#soft)"/>
      <rect x="0" y="0" width="660" height="220" filter="url(#grain)" opacity=".045"/>
      <text x="44" y="46" class="mono faint" font-size="11" letter-spacing="2.5">GITHUB</text>
${statBlocks}
    </g>
    <rect x=".5" y=".5" width="659" height="219" rx="26" class="edge" stroke-width="1"/>
    <path d="M26.5 .5 H633.5 A26 26 0 0 1 659.5 26.5" class="sheen" stroke-width="1" fill="none"/>
  </g>

  <g class="card dly">
    <g clip-path="url(#cB)">
      <rect x="684" y="0" width="316" height="220" rx="26" class="glass"/>
      <circle cx="1000" cy="0" r="100" class="orb" filter="url(#soft)"/>
      <rect x="684" y="0" width="316" height="220" filter="url(#grain)" opacity=".045"/>
      <text x="712" y="46" class="mono faint" font-size="11" letter-spacing="2.5">LANGUAGES</text>
${langRows}
    </g>
    <rect x="684.5" y=".5" width="315" height="219" rx="26" class="edge" stroke-width="1"/>
    <path d="M710.5 .5 H973.5 A26 26 0 0 1 999.5 26.5" class="sheen" stroke-width="1" fill="none"/>
  </g>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/stats.svg", svg);
console.log(`commits=${commits} stars=${stars} repos=${repos} followers=${followers}`);
console.log(langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(", "));
