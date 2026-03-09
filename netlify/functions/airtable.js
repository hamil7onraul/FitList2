const BASE_ID  = 'appCBkBHDMOqS3rbE';
const TABLE_ID = 'tblmVytcK7577DUMU';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

exports.handler = async (event) => {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  if (!TOKEN) return respond(500, { error: 'Token não configurado' });

  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const action  = event.queryStringParameters?.action;

  if (event.httpMethod === 'OPTIONS') return respond(200, {});

  try {
    if (action === 'list') {
      const customFilter = event.queryStringParameters?.filter;
      const defaultFilter = encodeURIComponent(`{Estado}="Aprovado"`);
      const filter = customFilter || defaultFilter;
      const res  = await fetch(`${BASE_URL}?filterByFormula=${filter}&sort[0][field]=Nome`, { headers });
      const data = await res.json();
      return respond(200, data);
    }
    if (action === 'update') {
      const id   = event.queryStringParameters?.id;
      if (!id) return respond(400, { error: 'ID em falta' });
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch(e) { body = {}; }
      if (!body.fields) return respond(400, { error: 'Could not find field "fields" in the request body' });
      const res  = await fetch(`${BASE_URL}/${id}`, { method:'PATCH', headers, body: JSON.stringify(body) });
      const data = await res.json();
      return respond(200, data);
    }
    if (action === 'click') {
      const id     = event.queryStringParameters?.id;
      const getRes = await fetch(`${BASE_URL}/${id}`, { headers });
      const record = await getRes.json();
      const count  = (record.fields?.['Cliques WhatsApp'] || 0) + 1;
      await fetch(`${BASE_URL}/${id}`, { method:'PATCH', headers, body: JSON.stringify({ fields:{ 'Cliques WhatsApp': count } }) });
      return respond(200, { ok: true });
    }
    if (action === 'register') {
      const body = JSON.parse(event.body || '{}');
      const res  = await fetch(BASE_URL, { method:'POST', headers, body: JSON.stringify({ fields: body }) });
      const data = await res.json();
      return respond(200, data);
    }
    return respond(400, { error: 'Acção inválida' });
  } catch(e) {
    return respond(500, { error: e.message });
  }
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body)
  };
}
