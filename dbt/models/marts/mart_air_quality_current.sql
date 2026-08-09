-- mart_air_quality_current: latest hourly reading per city + pollutant.
-- Powers the hero "Best AQI live + 7-city shortlist" on the dashboard.
select
    city,
    pollutant,
    value,
    unit,
    measured_at_utc
from {{ ref('fct_air_quality_measurements') }}
qualify row_number() over (
    partition by city, pollutant
    order by measured_at_utc desc
) = 1