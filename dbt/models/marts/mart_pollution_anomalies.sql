-- mart_pollution_anomalies: daily values that deviate strongly from the
-- city+pollutant baseline (z-score vs trailing 30-day rolling window).
with daily as (
    select
        city,
        pollutant,
        date(measured_at_utc) as date_day,
        avg(value) as avg_value
    from {{ ref('fct_air_quality_measurements') }}
    group by city, pollutant, date(measured_at_utc)
),
with_baseline as (
    select
        city,
        pollutant,
        date_day,
        avg_value,
        avg(avg_value) over (
            partition by city, pollutant
            order by date_day
            rows between 30 preceding and 1 preceding
        ) as baseline_mean,
        stddev(avg_value) over (
            partition by city, pollutant
            order by date_day
            rows between 30 preceding and 1 preceding
        ) as baseline_std
    from daily
)
select
    city,
    pollutant,
    date_day,
    avg_value,
    baseline_mean,
    baseline_std,
    case
        when baseline_std is null or baseline_std = 0 then null
        else (avg_value - baseline_mean) / nullif(baseline_std, 0)
    end as z_score
from with_baseline
where baseline_mean is not null
  and date_day >= date_trunc('day', current_date) - interval '3 days'