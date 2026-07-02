# Leak Stop CRM

CRM offline-first para prospecção comercial, pipeline de leads, exportação CSV e sincronização opcional via Netlify Function + Supabase.

## O que foi corrigido para circulação

- Interface reescrita com linguagem profissional de CRM.
- Remoção de conteúdo de conversa/mentoria que não pertencia ao produto.
- Token de sincronização não aparece mais preenchido na tela depois de salvo.
- Sanitização/escape de dados digitados pelo usuário antes da renderização.
- Exclusão sincronizada com tombstones (`excluida_em`), evitando que leads apagados voltem em outro dispositivo.
- Schema Supabase compatível com o código real do CRM.
- Segregação por `workspace_id` usando hash SHA-256 do token, sem gravar o token puro no banco.
- Filtros de banco sempre incluem `workspace_id`.
- Headers de segurança configurados no Netlify.
- Service Worker atualizado para não cachear funções de sincronização.

## Atenção urgente

Se algum token apareceu em print, conversa, commit ou vídeo, considere vazado.

1. Gere um novo `ADMIN_TOKEN` forte.
2. Atualize a variável no Netlify.
3. Limpe a chave salva nos navegadores antigos e salve a nova.
4. Se a `SUPABASE_SERVICE_KEY` vazou, rotacione a chave no Supabase e atualize no Netlify.

## Variáveis de ambiente no Netlify

Crie em **Site configuration → Environment variables**:

```bash
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_ROLE_KEY
ADMIN_TOKEN=uma-chave-aleatoria-com-mais-de-32-caracteres
ALLOWED_ORIGINS=https://crmleakstop.netlify.app
```

Opcionalmente, use múltiplos workspaces/tokens separados por vírgula:

```bash
ADMIN_TOKENS=token-workspace-1,token-workspace-2
```

> Observação: `SUPABASE_SERVICE_KEY` deve ser a service role key e nunca deve ir para o frontend, GitHub ou prints públicos.

## Banco de dados

1. Abra o Supabase.
2. Vá em **SQL Editor**.
3. Cole o conteúdo de `schema.sql`.
4. Execute.

O schema usa a tabela `public.prospectos` com chave primária composta por `(workspace_id, id)`.

## Deploy

### Netlify conectado ao GitHub

1. Faça commit dos arquivos.
2. No Netlify, conecte o repositório.
3. Build command: vazio.
4. Publish directory: `.`
5. Functions directory: `netlify/functions`
6. Configure as variáveis de ambiente.
7. Clique em **Deploy**.

### Teste rápido após deploy

- Abrir o CRM no celular.
- Criar um lead offline.
- Recarregar a página e confirmar persistência local.
- Configurar a chave de sincronização.
- Criar/editar/excluir lead.
- Abrir o mesmo CRM em outro navegador com a mesma chave.
- Confirmar que criação, edição e exclusão sincronizam.
- Exportar CSV.

## Limitações conhecidas do MVP

Este projeto ainda usa token compartilhado por workspace. Para vender como SaaS multiempresa, o próximo passo recomendado é autenticação real com Supabase Auth, convites por empresa, RBAC e auditoria completa por usuário.
