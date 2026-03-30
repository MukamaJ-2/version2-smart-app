-- Extend leaderboard with budget adherence from flux_pods (and nested children).
-- Ranks by leaderboard_score: blends savings_rate with budget_adherence when user has budgets with allocated > 0.

create or replace view public.savings_rates_anonymous as
with
base as (
  select
    tx.user_id,
    coalesce(income.total_income, 0) as total_income,
    coalesce(expenses.total_expenses, 0) as total_expenses,
    case
      when coalesce(income.total_income, 0) <= 0 then 0
      else greatest(
        0,
        least(1, (coalesce(income.total_income, 0) - coalesce(expenses.total_expenses, 0)) / income.total_income)
      )
    end as savings_rate
  from (
    select distinct user_id
    from public.transactions
  ) tx
  left join (
    select user_id, sum(amount) as total_income
    from public.transactions
    where type = 'income'
    group by user_id
  ) income on income.user_id = tx.user_id
  left join (
    select user_id, sum(amount) as total_expenses
    from public.transactions
    where type = 'expense'
    group by user_id
  ) expenses on expenses.user_id = tx.user_id
),
pod_scores as (
  select
    fp.user_id,
    fp.allocated::numeric as allocated,
    coalesce(fp.spent::numeric, 0) as spent
  from public.flux_pods fp
  union all
  select
    fp.user_id,
    coalesce((c.elem->>'allocated')::numeric, 0) as allocated,
    coalesce((c.elem->>'spent')::numeric, 0) as spent
  from public.flux_pods fp
  cross join lateral jsonb_array_elements(coalesce(fp.children, '[]'::jsonb)) as c(elem)
),
budget_agg as (
  select
    user_id,
    count(*) filter (where allocated > 0) as budget_pods_count,
    avg(
      case
        when allocated <= 0 then null
        when coalesce(spent, 0) <= allocated then 1::numeric
        else least(1::numeric, allocated / nullif(spent, 0))
      end
    ) filter (where allocated > 0) as budget_adherence
  from pod_scores
  group by user_id
)
select
  b.user_id,
  b.total_income,
  b.total_expenses,
  b.savings_rate,
  ba.budget_adherence,
  coalesce(ba.budget_pods_count, 0)::bigint as budget_pods_count,
  case
    when ba.budget_adherence is not null then
      0.35 * b.savings_rate + 0.65 * ba.budget_adherence
    else b.savings_rate
  end as leaderboard_score
from base b
left join budget_agg ba on ba.user_id = b.user_id;

alter view public.savings_rates_anonymous set (security_invoker = false);

grant select on public.savings_rates_anonymous to authenticated;
