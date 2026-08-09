-- int_measurements_hourly: roll raw measurements up to the hourly grain per
-- station + pollutant, averaged across duplicate sensor reads within the
-- same hour. AQI logic and gold marts all build on this layer.

select
    location_id as station_id,
    parameter as pollutant,
    date_trunc('hour', datetime_utc) as measured_at_utc,
    avg(value) as value,
    max(unit) as unit,
    count(*) as reading_count
from {{ ref('stg_measurements') }}
group by
    location_id,
    parameter,
    date_trunc('hour', datetime_utc)