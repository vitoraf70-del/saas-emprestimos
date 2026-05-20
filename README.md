# LoanERP SaaS

Sistema SaaS de gestão de empréstimos e cobranças com foco em automação WhatsApp + PIX.

## Stack

- Next.js 14 (App Router)
- API Routes + Server Actions
- Supabase PostgreSQL + Prisma ORM
- NextAuth
- Tailwind CSS + componentes estilo shadcn/ui
- Recharts
- WhatsApp: Evolution API ou Z-API
- PIX: Mercado Pago ou Asaas
- Deploy Vercel

## Módulos implementados

- Dashboard com KPIs de crédito, lucro e inadimplência
- Gestão de clientes
- Gestão de empréstimos e parcelas
- Recalculo automático de juros/multa por atraso
- Cobrança pública por CPF (`/cobranca/[cpf]`) com QRCode PIX
- Baixa automática ao pagar PIX: webhook do banco + verificação na página `/pagar` + cron de reconciliação a cada 15 min
- Robô de cobrança WhatsApp (`/api/cron/cobrancas`): 2 avisos 2 dias antes do vencimento, 3 no dia, e aviso diário em atraso com link `/pagar` e valor atualizado (multa/juros)
- Relatórios exportáveis (PDF/Excel)

## Estrutura

```txt
src/
  app/
    (app)/
      clientes/
      emprestimos/
      parcelas/
      relatorios/
      page.tsx
    cobranca/[cpf]/page.tsx
    api/
      auth/[...nextauth]/route.ts
      pix/confirm/route.ts
      pix/webhook/route.ts
      cron/cobrancas/route.ts
      reports/[type]/route.ts
  actions/
  components/
  lib/
prisma/schema.prisma
vercel.json
```

## Setup

1. Instale Node.js LTS (inclui npm).
2. Copie `.env.example` para `.env` e preencha as chaves.
3. Rode:
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
   - `npm run seed`
   - `npm run dev`

## Observações de produção

- O seed grava a senha do admin com bcrypt. Rode `npm run seed` após deploy ou defina `SEED_ADMIN_PASSWORD` no `.env`.
- Configure `CRON_SECRET` na Vercel; o cron chama `/api/cron/cobrancas?secret=...` ou envia `Authorization: Bearer <secret>`.
- **Inter (webhook PIX):** URL `https://SEU_DOMINIO/api/webhooks/pix/inter`. Cadastro automático (com `CRON_SECRET` e variáveis Inter na Vercel):
  - `POST https://SEU_DOMINIO/api/webhooks/pix/inter/register?secret=CRON_SECRET`
  - ou local: `npm run inter:webhook` (defina `NEXT_PUBLIC_APP_URL` para produção)
  - consultar: `GET .../register?secret=...` ou `npm run inter:webhook:status`
  - O Inter **não** envia `x-webhook-secret`; a baixa valida `txid` no banco + status CONCLUIDA na API Inter.
- **C6:** `https://SEU_DOMINIO/api/webhooks/pix/c6` (mesmo header, se usar).
- Fallback genérico: `/api/pix/webhook` (Mercado Pago / Asaas).
- Configure domínio e variáveis na Vercel.
- Plano **Hobby** da Vercel: 1 cron por dia (`0 11 * * *` UTC ≈ 08h BRT), que roda cobrança WhatsApp + reconciliação PIX. Para 3 avisos/dia no vencimento, use plano **Pro** ou cron externo (ex. cron-job.org) chamando `/api/cron/cobrancas` com `CRON_SECRET`.
- Configure Evolution API ou Z-API (`WHATSAPP_PROVIDER`) para o robô enviar mensagens.
