# Revisão sênior aplicada

Data: 2026-07-02

## Problemas encontrados

- A interface continha textos de conversa/roteiro de negócio, não linguagem de produto CRM.
- O token aparecia em campo visível, facilitando vazamento por print.
- O schema SQL era de outro produto (`triagens`) e não batia com a função de sync (`prospectos`).
- A função fazia update por `id` sem filtrar `workspace_id`, risco crítico entre workspaces.
- Exclusões locais não eram sincronizadas corretamente e poderiam voltar após sync.
- Havia script injetado de terceiros no `index.html`.
- Headers e documentação estavam incompletos para circulação.

## Correções entregues

- Reescrita do `index.html` como CRM profissional offline-first.
- Token salvo em `localStorage`, mas não exibido depois de salvo.
- Sincronização com hash SHA-256 do token como `workspace_id`.
- Supabase Function com validação de token em tempo constante.
- Upsert com chave composta `(workspace_id, id)`.
- Tombstones para exclusão sincronizada (`excluida_em`).
- Sanitização de entrada e escape de saída na interface.
- CSV exportável.
- Service Worker atualizado e sem cache de funções.
- `schema.sql` compatível com o CRM.
- `README.md`, `SECURITY.md` e `.env.example` adicionados.

## Antes de colocar em produção

1. Rotacione imediatamente o `ADMIN_TOKEN` que apareceu em print.
2. Rotacione a `SUPABASE_SERVICE_KEY` se houver qualquer chance de exposição.
3. Execute o novo `schema.sql` no Supabase.
4. Configure `ALLOWED_ORIGINS` no Netlify.
5. Faça novo deploy.
6. Teste sync em dois dispositivos.

## Observação de arquitetura

O MVP está aceitável para uso controlado por um workspace/token. Para circular como SaaS multiempresa, implemente autenticação real com Supabase Auth, workspaces, membros, papéis e auditoria por usuário.
