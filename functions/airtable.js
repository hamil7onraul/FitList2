const BASE_ID       = 'appCBkBHDMOqS3rbE';
const TABLE_ID      = 'tblmVytcK7577DUMU';
const PEDIDOS_ID    = 'tbltJJIUiQc9VFN8z';
const PARCEIROS_ID  = 'tbliR2rgG2RMFhH3a';
const EVENTOS_ID    = 'tblylAuVaILrnOl08';
const BASE_URL      = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const PEDIDOS_URL   = `https://api.airtable.com/v0/${BASE_ID}/${PEDIDOS_ID}`;
const PARCEIROS_URL = `https://api.airtable.com/v0/${BASE_ID}/${PARCEIROS_ID}`;
const EVENTOS_URL   = `https://api.airtable.com/v0/${BASE_ID}/${EVENTOS_ID}`;

// Nome EXACTO da coluna no Airtable que guarda o token do link mágico.
// Se a tua coluna tiver outro nome, muda apenas esta linha.
const TOKEN_FIELD = 'Token';

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
      // SEGURANÇA: nunca expor publicamente o token de edição nem o email.
      // O token dá acesso de escrita ao perfil — se fosse devolvido aqui,
      // qualquer pessoa podia editar qualquer perfil.
      if (data.records) {
        data.records.forEach(r => {
          if (r.fields) {
            delete r.fields[TOKEN_FIELD];
            delete r.fields['Email'];
          }
        });
      }
      return respond(200, data);
    }

    if (action === 'get') {
      const token = url.searchParams.get('token');
      if (!token) return respond(400, { error: 'Token em falta' });
      // Procura o registo cujo token corresponde — devolve no formato {records:[...]}
      // que o site espera. Aspas removidas do token para evitar injecção na fórmula.
      const safe   = token.replace(/["\\]/g, '');
      const filter = encodeURIComponent(`{${TOKEN_FIELD}}="${safe}"`);
      const res  = await fetch(`${BASE_URL}?filterByFormula=${filter}&maxRecords=1`, { headers });
      const data = await res.json();
      return respond(200, data);
    }

    if (action === 'update') {
      const token = url.searchParams.get('token');
      const body  = await request.json();
      const id    = body.id || url.searchParams.get('id');
      if (!token) return respond(403, { error: 'Token em falta' });
      if (!id)    return respond(400, { error: 'ID em falta' });
      if (!body.fields) return respond(400, { error: 'Fields em falta' });

      // SEGURANÇA: confirmar que o token pertence mesmo a este registo
      // antes de permitir qualquer alteração.
      const checkRes = await fetch(`${BASE_URL}/${id}`, { headers });
      const record   = await checkRes.json();
      if (!record.fields || record.fields[TOKEN_FIELD] !== token) {
        return respond(403, { error: 'Token inválido para este perfil' });
      }

      // Garantir que Especialidade é sempre array para Multiple Select
      if (body.fields['Especialidade'] !== undefined) {
        const e = body.fields['Especialidade'];
        body.fields['Especialidade'] = Array.isArray(e) ? e : [e];
      }
      const res  = await fetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: body.fields })
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
      // Garantir que Especialidade é sempre array para Multiple Select
      if (body['Especialidade'] !== undefined) {
        const e = body['Especialidade'];
        body['Especialidade'] = Array.isArray(e) ? e : [e];
      }
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

    if (action === 'eventos') {
      const res  = await fetch(`${EVENTOS_URL}?sort[0][field]=Data&sort[0][direction]=asc`, { headers });
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
