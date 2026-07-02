# Guia rápido pelo iPhone 11

Você só precisa fazer hospedagem/configuração. O código já está pronto.

## Parte 1 — Supabase

1. Acesse o Supabase pelo Safari.
2. Abra seu projeto.
3. Vá em **SQL Editor**.
4. Cole o conteúdo do arquivo `schema.sql`.
5. Toque em **Run**.
6. Copie:
   - `SUPABASE_URL`
   - `service_role key` / `SUPABASE_SERVICE_KEY`

## Parte 2 — Netlify

No Netlify, no site do CRM:

1. Vá em **Site configuration**.
2. Entre em **Environment variables**.
3. Configure:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_KEY=SUA_SERVICE_ROLE_KEY
ADMIN_TOKEN=GERE-UMA-CHAVE-NOVA-COM-MAIS-DE-32-CARACTERES
ALLOWED_ORIGINS=https://crmleakstop.netlify.app
```

Atenção: o token que apareceu no print deve ser trocado. Considere vazado.

## Parte 3 — Subir os arquivos

### Melhor caminho

Como o projeto já está no GitHub e conectado ao Netlify, substitua os arquivos no repositório pelos arquivos deste pacote. Depois o Netlify faz deploy automático.

Arquivos principais que precisam ir para o GitHub:

- `index.html`
- `netlify.toml`
- `schema.sql`
- `sw.js`
- `netlify/functions/sync-prospectos.js`
- `README.md`
- `SECURITY.md`
- `privacidade.html`
- `termos.html`
- `.env.example`

### Se for usar upload manual do Netlify

Use o pacote `leak-stop-crm-netlify-ready.zip`. Se o Netlify aceitar ZIP com funções, envie esse arquivo. Se não aceitar as funções, use o caminho do GitHub acima.

## Parte 4 — Teste final

1. Abra o site no iPhone.
2. Toque em **Chave**.
3. Cole o mesmo valor do `ADMIN_TOKEN` configurado no Netlify.
4. Salve e sincronize.
5. Cadastre um lead.
6. Atualize o status.
7. Exporte CSV.
8. Abra em outro navegador/celular, coloque a mesma chave e teste se sincroniza.

## O que não fazer

- Não mande print com token aparecendo.
- Não cole `SUPABASE_SERVICE_KEY` em lugar público.
- Não publique `.env` com valores reais no GitHub.
- Não use o token antigo que apareceu no print.
