-- stg_stations: deduplicated station metadata, keeping the latest fetch per
-- location_id (OpenAQ station records are idempotent).

select
    location_id as station_id,
    coalesce(locality, city) as station_name,
    city,
    locality,
    country,
    latitude,
    longitude,
    sensors_count,
    fetched_at_utc
from {{ source('bronze', 'locations') }}
qualify row_number() over (
    partition by location_id
    order by fetched_at_utc desc
) = 1