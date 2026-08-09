-- stg_measurements: clean, validated raw measurements from OpenAQ.
-- Filters to the pollutants we care about and rejects invalid values.

select
    location_id,
    sensor_ids,
    parameter,
    unit,
    value,
    datetime_utc,
    datetime_local,
    fetched_at_utc
from {{ source('bronze', 'measurements') }}
where parameter in ('pm25', 'pm10', 'o3', 'no2')
  and value is not null
  and value >= 0
  and datetime_utc is not null