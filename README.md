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
- Confirmação de pagamento e baixa automática da parcela
- CRON diário de cobrança (`/api/cron/cobrancas`)
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

- Ajuste senha para hash seguro (bcrypt/argon2) antes de produção.
- Configure webhook real do provedor PIX em `/api/pix/webhook`.
- Configure domínio e variáveis na Vercel.
- O cron do Vercel está em UTC. `0 11 * * *` equivale a 08:00 BRT.
