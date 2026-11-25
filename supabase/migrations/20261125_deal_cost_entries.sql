-- Deal Cost Entries table for Credit Control (PO -> Sales Order margin tracking)
create table if not exists public.deal_cost_entries (
  id text primary key,
  company_id text not null,
  purchase_order_id text not null,
  order_id text not null,
  purchase_unit_price numeric not null default 0,
  purchase_quantity numeric not null default 0,
  sales_unit_price numeric not null default 0,
  sales_quantity numeric not null default 0,
  buy_transport numeric not null default 0,
  buy_labor numeric not null default 0,
  buy_misc numeric not null default 0,
  sell_handling numeric not null default 0,
  sell_misc numeric not null default 0,
  sell_transport numeric not null default 0,
  buy_total numeric not null default 0,
  sell_total numeric not null default 0,
  margin numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deal_cost_entries_company_created
  on public.deal_cost_entries (company_id, created_at desc);

alter table public.deal_cost_entries enable row level security;

drop policy if exists "deal_cost_entries_select" on public.deal_cost_entries;
create policy "deal_cost_entries_select"
  on public.deal_cost_entries for select
  to authenticated, anon
  using (true);

drop policy if exists "deal_cost_entries_insert" on public.deal_cost_entries;
create policy "deal_cost_entries_insert"
  on public.deal_cost_entries for insert
  to authenticated, anon
  with check (true);

drop policy if exists "deal_cost_entries_delete" on public.deal_cost_entries;
create policy "deal_cost_entries_delete"
  on public.deal_cost_entries for delete
  to authenticated, anon
  using (true);
