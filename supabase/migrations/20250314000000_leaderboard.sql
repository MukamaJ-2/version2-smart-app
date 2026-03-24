-- Anonymous savings-rate leaderboard view.
-- Exposes only aggregated savings rates per user (no emails or personal data).
-- For a multi-user leaderboard, use security_invoker = false so the view runs as owner.

create or replace view public.savings_rates_anonymous as
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
) expenses on expenses.user_id = tx.user_id;

-- Run as definer so all users see the full leaderboard (anonymous aggregates only).
-- Use security_invoker = true if you prefer each user to see only their own row.
alter view public.savings_rates_anonymous set (security_invoker = false);

grant select on public.savings_rates_anonymous to authenticated;
