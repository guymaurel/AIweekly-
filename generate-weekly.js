import fs from "fs";
import path from "path";
import RSSParser from "rss-parser";

// --- SITE ---
const SITE = {
  name: "AI Weekly (FR)",
  desc: "Chaque semaine, le meilleur de l'IA & de la tech en français.",
  lang: "fr"
};

// --- SOURCES FR ---
const FEEDS = [
  "https://www.numerama.com/feed/",
  "https://siecledigital.fr/feed/",
  "https://www.zdnet.fr/feeds/rss/actualites/",
  "https://www.frandroid.com/feed",
  "https://www.journaldugeek.com/feed/",
  "https://www.01net.com/rss/"
];

// --- OUT ---
const OUT = "public";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const toFR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const toISODate = (d) => new Date(d).toISOString().slice(0,10);

function last7days(now = new Date()){
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end };
}

function strip(html = "") {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function pickWhy(title = "") {
  const t = title.toLowerCase();
  if (/(ia|intelligence artificielle|llm|gpt|openai|chatgpt|modèle)/i.test(t)) return "Impact IA : productivité, automatisations et nouveaux usages.";
  if (/(régulation|cnil|rgpd|dma|dsa|loi|amf)/i.test(t)) return "Impact réglementaire : conformité et gouvernance des données.";
  if (/(nvidia|gpu|puce|chip|arm|amd|intel)/i.test(t)) return "Impact matériel : performances et coûts d’infrastructure.";
  if (/(sécurité|faille|cyber|ransomware|attaque)/i.test(t)) return "Impact sécurité : risque accru; correctifs et surveillance.";
  if (/(cloud|aws|azure|gcp)/i.test(t)) return "Impact cloud : coûts/performances et architecture à revoir.";
  return "Intérêt business : opportunités produit et efficacité opérationnelle.";
}

function sectionFrom(item){
  const raw = item.contentSnippet || item.content || item.summary || "";
  const bref = strip(raw).split(" ").slice(0,90).join(" ");
  return `
<h2>${item.title}</h2>
<p class="meta">Source : <a href="${item.link}" target="_blank" rel="noopener">${item.source}</a> • ${toFR.format(item.date)}</p>
<p><strong>En bref :</strong> ${bref}…</p>
<p><strong>Pourquoi c’est important :</strong> ${pickWhy(item.title)}</p>`;
}

function layout(title, content){
  return `<!doctype html><html lang="${SITE.lang}"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} • ${SITE.name}</title>
<style>
:root{--bg:#0f172a;--card:#111827;--muted:#94a3b8;--text:#e2e8f0;--accent:#6366f1}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Arial;background:var(--bg);color:var(--text)}
header,main,footer{max-width:980px;margin:0 auto;padding:16px}
a{color:#c7d2fe;text-decoration:none}.meta{color:var(--muted)}
.card{background:var(--card);border:1px solid #1f2937;border-radius:14px;padding:16px}
h1,h2{margin:.4em 0}ul{margin:.4em 0 0.8em 1em}
</style></head><body>
<header><h1><a href="./">${SITE.name}</a></h1><p class="meta">${SITE.desc}</p></header>
<main>${content}</main>
<footer><p class="meta">© ${new Date().getFullYear()} ${SITE.name}</p></footer>
</body></html>`;
}

async function fetchItems(){
  const parser = new RSSParser();
  const { start, end } = last7days();
  const items = [];
  for (const url of FEEDS){
    try {
      const feed = await parser.parseURL(url);
      for (const it of feed.items.slice(0,15)){
        const pub = new Date(it.isoDate || it.pubDate || Date.now());
        if (pub >= start && pub <= end){
          items.push({
            title: it.title || "(sans titre)",
            link: it.link || "",
            date: pub,
            source: feed.title || new URL(url).hostname,
            contentSnippet: it.contentSnippet || it.content || it.summary || ""
          });
        }
      }
    } catch(e){
      console.warn("Feed error:", url, e.message);
    }
  }
  const seen = new Set();
  const uniq = items.filter(x => (seen.has(x.link) ? false : (seen.add(x.link), true)));
  return uniq.sort((a,b)=> b.date - a.date);
}

function writeIndex(latestSlug, latestTitle, archives){
  const items = archives.map(x => `<li><a href="./${x.slug}/">${x.title}</a> • <span class="meta">${x.date}</span></li>`).join("");
  const html = layout(SITE.name, `
  <div class="card">
    <h2>Dernier article</h2>
    <p><a href="./${latestSlug}/">${latestTitle}</a></p>
  </div>
  <div class="card">
    <h2>Archives</h2>
    <ul>${items}</ul>
  </div>`);
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}

async function main(){
  const all = await fetchItems();
  const top = all.slice(0,5);
  const watch = all.slice(5,8);

  const today = toISODate(new Date());
  const slug = today;
  const title = `Cette semaine en IA & Tech (${today})`;

  const intro = `<p>Voici l’essentiel de la semaine écoulée côté IA & tech, en français et sans jargon inutile. Sélection de sources fiables et liens vers les articles originaux.</p>`;
  const sections = top.map(sectionFrom).join("\n");
  const surveiller = watch.length
    ? `<h3>À surveiller</h3><ul>${watch.map(i => `<li><a href="${i.link}" target="_blank" rel="noopener">${i.title}</a> — <span class="meta">${i.source}</span></li>`).join("")}</ul>`
    : "";

  const article = layout(title, `<div class="card"><h1>${title}</h1>${intro}${sections}${surveiller}</div>`);

  const dir = path.join(OUT, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), article);

  const archives = fs.readdirSync(OUT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({ slug: d.name, title: `Cette semaine en IA & Tech (${d.name})`, date: d.name }))
    .sort((a,b)=> b.slug.localeCompare(a.slug))
    .slice(0,26);

  writeIndex(slug, title, archives);
  console.log(`OK — généré: ${title} • Sections: ${top.length} • Watch: ${watch.length}`);
}

try { await main(); }
catch(e){
  console.error("GENERATION FAILED:", e);
  process.exit(0);
}
