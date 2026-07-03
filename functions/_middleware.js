// FitList — Preview dinâmico de perfis (Open Graph)
//
// O QUE ISTO FAZ: quando alguém partilha um link de perfil no WhatsApp
// (ex: fitlist2.pages.dev/carlos-mbemba), o robô do WhatsApp visita o
// link para gerar o cartão de preview. Este middleware detecta esses
// robôs e devolve-lhes uma página com a FOTO e NOME do treinador —
// em vez do preview genérico do site.
//
// Visitantes humanos nunca passam por aqui: seguem direto para o site.

const BASE_ID     = 'appCBkBHDMOqS3rbE';
const TABLE_ID    = 'tblmVytcK7577DUMU';
const SITE_NAME   = 'FitList';
const DEFAULT_IMG = 'https://fitlist2.pages.dev/og-image.jpg';

const BOT_RE = /WhatsApp|facebookexternalhit|facebookcatalog|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|SkypeUriPreview/i;

export async function onRequest(context) {
  const { request, env, next } = context;

  try {
    const url = new URL(request.url);
    const ua  = request.headers.get('user-agent') || '';

    // Só interessa a robôs de preview — humanos seguem para o site
    if (!BOT_RE.test(ua)) return next();

    // É um link de perfil? Duas formas: ?perfil=recXXX ou /nome-do-pt
    const perfilId = url.searchParams.get('perfil');
    const path     = url.pathname.replace(/^\/+|\/+$/g, '');
    const isSlug   = path.length > 0 && !path.includes('.') && path !== 'airtable';
    if (!perfilId && !isSlug) return next();

    const TOKEN = env.AIRTABLE_TOKEN;
    if (!TOKEN) return next();
    const headers = { 'Authorization': `Bearer ${TOKEN}` };
    const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

    let fields = null;

    if (perfilId) {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(perfilId)}`, { headers });
      if (res.ok) fields = (await res.json()).fields || null;
    } else {
      // Resolve o slug: vai buscar os aprovados e compara nomes "slugificados"
      const filter = encodeURIComponent(`{Estado}="Aprovado"`);
      const res = await fetch(`${BASE_URL}?filterByFormula=${filter}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const match = (data.records || []).find(r => slugify(r.fields?.['Nome']) === path);
        if (match) fields = match.fields;
      }
    }

    if (!fields || !fields['Nome']) return next();

    // Monta os dados do preview
    const nome  = fields['Nome'];
    const espec = Array.isArray(fields['Especialidade'])
      ? fields['Especialidade'].join(' · ')
      : (fields['Especialidade'] || 'Treinador');
    const zona  = fields['Zona'] ? `${fields['Zona']}, Luanda` : 'Luanda';
    const foto  = (fields['Foto Perfil'] && fields['Foto Perfil'] !== 'REMOVED')
      ? fields['Foto Perfil']
      : (fields['Foto']?.[0]?.url || DEFAULT_IMG);
    const title = `${nome} — ${espec} | ${SITE_NAME}`;
    const desc  = `${espec} em ${zona}. Vê o perfil, preços e contacta directamente via WhatsApp no ${SITE_NAME}.`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta property="og:type" content="profile">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(foto)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(foto)}">
<meta http-equiv="refresh" content="0;url=${esc(url.href)}">
</head>
<body>${esc(title)}</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });

  } catch (e) {
    // Qualquer erro: nunca bloquear o site — segue para o normal
    return next();
  }
}

function slugify(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
