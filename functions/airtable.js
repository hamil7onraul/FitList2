const BASE_ID       = 'appCBkBHDMOqS3rbE';
const TABLE_ID      = 'tblmVytcK7577DUMU';
const PEDIDOS_ID    = 'tbltJJIUiQc9VFN8z';
const PARCEIROS_ID  = 'tbliR2rgG2RMFhH3a';
const BASE_URL      = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const PEDIDOS_URL   = `https://api.airtable.com/v0/${BASE_ID}/${PEDIDOS_ID}`;
const PARCEIROS_URL = `https://api.airtable.com/v0/${BASE_ID}/${PARCEIROS_ID}`;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const TOKEN = env.AIRTABLE_TOKEN;
  if (!TOKEN) return respond(500, { error: 'Token não configurado' });

  const url    = new URL(request.url);
  const action = url.searchParams.get('action');
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    if (action === 'list') {
      const customFilter = url.searchParams.get('filter');
      const defaultFilter = encodeURIComponent(`{Estado}="Aprovado"`);
      const filter = customFilter || defaultFilter;
      const res  = await fetch(`${BASE_URL}?filterByFormula=${filter}&sort[0][field]=Nome`, { headers });
      const data = await res.json();
      return respond(200, data);
    }

    if (action === 'update') {
      const id   = url.searchParams.get('id');
      if (!id) return respond(400, { error: 'ID em falta' });
      const body = await request.json();
      if (!body.fields) return respond(400, { error: 'Fields em falta' });
      const res  = await fetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return respond(200, data);
    }

    if (action === 'click') {
      const id     = url.searchParams.get('id');
      const getRes = await fetch(`${BASE_URL}/${id}`, { headers });
      const record = await getRes.json();
      const count  = (record.fields?.['Cliques WhatsApp'] || 0) + 1;
      await fetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: { 'Cliques WhatsApp': count } })
      });
      return respond(200, { ok: true });
    }

    if (action === 'register') {
      const body = await request.json();
      const res  = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: body })
      });
      const data = await res.json();
      return respond(200, data);
    }

    if (action === 'pedido') {
      const body = await request.json();
      const res  = await fetch(PEDIDOS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: body })
      });
      const data = await res.json();
      return respond(200, data);
    }

    if (action === 'parceiro') {
      const body = await request.json();
      const res  = await fetch(PARCEIROS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: body })
      });
      const data = await res.json();
      return respond(200, data);
    }

    return respond(400, { error: 'Acção inválida' });

  } catch(e) {
    return respond(500, { error: e.message });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
