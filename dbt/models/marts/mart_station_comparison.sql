-- mart_station_comparison: latest reading per station + pollutant, comparing
-- every station across the monitored cities.
select
    station_id,
    station_name,
    city,
    pollutant,
    value,
    unit,
    measured_at_utc
from {{ ref('fct_air_quality_measurements') }}
qualify row_number() over (
    partition by station_id, pollutant
    order by measured_at_utc desc
) = 1