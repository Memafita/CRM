/*
 * Leak Stop CRM - Netlify Function de sincronização offline-first.
 *
 * Segurança:
 * - SUPABASE_SERVICE_KEY fica somente no ambiente do Netlify.
 * - O token do usuário é validado em tempo constante e convertido para hash SHA-256.
 * - Todos os filtros de banco incluem workspace_id para impedir vazamento entre workspaces.
 * - Exclusões são propagadas por tombstones (excluida_em).
 */
const crypto = require('crypto');

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_API || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ADMIN_TOKENS = (process.env.ADMIN_TOKENS || '').split(',').map((token) => token.trim()).filter(Boolean);
const MAX_BODY_BYTES = 1_000_000;
const MAX_ROWS = 5000;

exports.handler = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  const headers = securityHeaders(allowedOrigin);

  if (event.httpMethod === 'OPTIONS') {
    if (!allowedOrigin) return { statusCode: 403, headers: securityHeaders(''), body: '' };
    return { statusCode: 204, headers, body: '' };
  }

  if (!allowedOrigin && event.headers.origin) {
    return json(403, { erro: 'origem nao autorizada' }, headers);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { erro: 'metodo nao permitido' }, headers);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !configuredTokens().length) {
    console.error('sync misconfigured: missing env vars');
    return json(500, { erro: 'servidor mal configurado' }, headers);
  }

  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json(413, { erro: 'payload muito grande' }, headers);
  }

  const token = extractBearer(event.headers.authorization || event.headers.Authorization || '');
  if (!isTokenAllowed(token)) {
    return json(401, { erro: 'nao autorizado' }, headers);
  }

  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch (_) {
    return json(400, { erro: 'json invalido' }, headers);
  }

  const workspaceId = workspaceIdFromToken(token);
  const incomingLeads = Array.isArray(body.prospectos) ? body.prospectos.slice(0, MAX_ROWS).map(normalizeLead).filter(Boolean) : [];
  const incomingDeleted = Array.isArray(body.deleted_ids) ? body.deleted_ids.slice(0, MAX_ROWS).map(normalizeDeleted).filter(Boolean) : [];

  try {
    const existing = await supabaseGet(`prospectos?select=id,atualizado_em,excluida_em&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=${MAX_ROWS}`);
    const existingMap = new Map((Array.isArray(existing) ? existing : []).map((row) => [String(row.id), row]));

    const activeRows = [];
    for (const lead of incomingLeads) {
      const current = existingMap.get(lead.id);
      if (current && current.excluida_em && new Date(current.excluida_em) > new Date(lead.updatedAt)) continue;
      if (!current || new Date(lead.updatedAt) >= new Date(current.atualizado_em || 0)) {
        activeRows.push(toSupabaseLead(lead, workspaceId));
      }
    }

    const tombstoneRows = [];
    for (const deletion of incomingDeleted) {
      const current = existingMap.get(deletion.id);
      const currentStamp = maxDate(current && current.atualizado_em, current && current.excluida_em);
      if (!current || new Date(deletion.deletedAt) >= currentStamp) {
        tombstoneRows.push({
          workspace_id: workspaceId,
          id: deletion.id,
          nome: current && current.nome ? current.nome : '',
          status: current && current.status ? current.status : 'new',
          atualizado_em: deletion.deletedAt,
          excluida_em: deletion.deletedAt
        });
      }
    }

    if (activeRows.length) await supabaseUpsert('prospectos', activeRows, 'workspace_id,id');
    if (tombstoneRows.length) await supabaseUpsert('prospectos', tombstoneRows, 'workspace_id,id');

    const serverLeads = await supabaseGet(
      `prospectos?select=id,nome,telefone,nicho,origem,status,valor,notas,criado_em,atualizado_em&workspace_id=eq.${encodeURIComponent(workspaceId)}&excluida_em=is.null&order=atualizado_em.desc&limit=${MAX_ROWS}`
    );
    const serverDeleted = await supabaseGet(
      `prospectos?select=id,excluida_em&workspace_id=eq.${encodeURIComponent(workspaceId)}&excluida_em=not.is.null&order=excluida_em.desc&limit=${MAX_ROWS}`
    );

    return json(200, {
      ok: true,
      prospectos: (Array.isArray(serverLeads) ? serverLeads : []).map(fromSupabaseLead),
      deleted_ids: (Array.isArray(serverDeleted) ? serverDeleted : []).map((row) => ({ id: String(row.id), deletedAt: toISO(row.excluida_em) })).filter((row) => row.id && row.deletedAt),
      sincronizado_em: new Date().toISOString()
    }, headers);
  } catch (error) {
    console.error('sync error', error && error.message ? error.message : error);
    return json(500, { erro: 'erro interno' }, headers);
  }
};

function configuredTokens() {
  return [ADMIN_TOKEN, ...ADMIN_TOKENS].filter(Boolean);
}

function extractBearer(header) {
  return String(header || '').replace(/^Bearer\s+/i, '').trim();
}

function isTokenAllowed(token) {
  if (!token || token.length < 32 || token.length > 512) return false;
  return configuredTokens().some((allowed) => timingSafeStringEqual(token, allowed));
}

function timingSafeStringEqual(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function workspaceIdFromToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeLead(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = sanitizeId(raw.id);
  const name = sanitizeText(raw.name || raw.nome, 120);
  if (!id || !name) return null;
  return {
    id,
    name,
    phone: sanitizeText(raw.phone || raw.telefone, 32),
    segment: sanitizeEnum(raw.segment || raw.niche || raw.nicho, ['restaurante', 'beleza', 'saude', 'pet', 'fitness', 'varejo', 'servicos', 'outro'], 'outro'),
    source: sanitizeEnum(raw.source || raw.origem, ['google_maps', 'instagram', 'indicacao', 'site', 'evento', 'outro'], 'outro'),
    status: sanitizeEnum(raw.status, ['new', 'contacted', 'negotiation', 'client', 'lost'], 'new'),
    value: sanitizeNumber(raw.value ?? raw.valor),
    notes: sanitizeText(raw.notes || raw.notas, 1200),
    createdAt: toISO(raw.createdAt || raw.criado_em) || new Date().toISOString(),
    updatedAt: toISO(raw.updatedAt || raw.atualizado_em) || new Date().toISOString()
  };
}

function normalizeDeleted(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = sanitizeId(raw.id);
  const deletedAt = toISO(raw.deletedAt || raw.deleted_at || raw.excluida_em);
  return id && deletedAt ? { id, deletedAt } : null;
}

function toSupabaseLead(lead, workspaceId) {
  return {
    workspace_id: workspaceId,
    id: lead.id,
    nome: lead.name,
    telefone: lead.phone,
    nicho: lead.segment,
    origem: lead.source,
    status: lead.status,
    valor: lead.value,
    notas: lead.notes,
    criado_em: lead.createdAt,
    atualizado_em: lead.updatedAt,
    excluida_em: null
  };
}

function fromSupabaseLead(row) {
  return {
    id: String(row.id),
    name: row.nome || '',
    phone: row.telefone || '',
    segment: row.nicho || 'outro',
    source: row.origem || 'outro',
    status: row.status || 'new',
    value: Number(row.valor || 0),
    notes: row.notas || '',
    createdAt: toISO(row.criado_em) || new Date().toISOString(),
    updatedAt: toISO(row.atualizado_em) || new Date().toISOString()
  };
}

async function supabaseGet(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: supabaseHeaders()
  });
  return parseSupabaseResponse(response);
}

async function supabaseUpsert(table, rows, onConflict) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows)
  });
  await parseSupabaseResponse(response, true);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function parseSupabaseResponse(response, allowEmpty = false) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!text) return allowEmpty ? null : [];
  try { return JSON.parse(text); }
  catch (_) { return allowEmpty ? null : []; }
}

function sanitizeId(value) {
  return String(value == null ? '' : value).trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 96);
}

function sanitizeText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(number, 9_999_999)) : 0;
}

function toISO(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function maxDate(a, b) {
  const da = a ? new Date(a) : new Date(0);
  const db = b ? new Date(b) : new Date(0);
  return da > db ? da : db;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function normalizeSupabaseUrl(value) {
  const trimmed = trimTrailingSlash(value.trim());
  const dashboardMatch = trimmed.match(/^https?:\/\/(?:app\.)?supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboardMatch) return `https://${dashboardMatch[1]}.supabase.co`;
  return trimmed;
}

function resolveAllowedOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const host = event.headers.host || event.headers.Host || '';
  const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);

  if (!origin) return '*';
  if (configured.includes(origin)) return origin;

  try {
    const originHost = new URL(origin).host;
    if (host && originHost === host) return origin;
  } catch (_) {
    return '';
  }

  return '';
}

function securityHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(statusCode, payload, headers) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}
