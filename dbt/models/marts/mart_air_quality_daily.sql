-- mart_air_quality_daily: daily average per city + pollutant across all
-- stations in that city. Feeds trend charts.
select
    city,
    pollutant,
    date(measured_at_utc) as date_day,
    avg(value) as avg_value,
    min(value) as min_value,
    max(value) as max_value,
    count(*) as reading_count
from {{ ref('fct_air_quality_measurements') }}
group by city, pollutant, date(measured_at_utc)