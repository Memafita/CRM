# Segurança do Leak Stop CRM

## Regras obrigatórias

- Não publique `SUPABASE_SERVICE_KEY`, `ADMIN_TOKEN` ou `ADMIN_TOKENS` no GitHub.
- Não tire print com token visível.
- Rotacione qualquer chave que tenha aparecido em conversa, print, vídeo ou commit.
- Use `ALLOWED_ORIGINS` em produção para restringir chamadas da função.
- Execute o `schema.sql` atual antes de ativar a sincronização.

## Modelo atual

O CRM é offline-first e usa uma chave de sincronização por workspace. A Netlify Function valida essa chave e grava dados no Supabase usando service role key somente no backend.

O banco recebe `workspace_id = sha256(token)`, não o token puro.

## Próximo nível recomendado

Antes de circular como produto SaaS com múltiplas empresas/clientes pagantes:

1. Implementar Supabase Auth.
2. Criar tabela `workspaces` e `workspace_members`.
3. Substituir token compartilhado por sessão autenticada.
4. Ativar RBAC por papel: owner/admin/member.
5. Registrar auditoria por usuário: criação, edição, exclusão e exportação.
6. Criar política de privacidade e termos de uso.
