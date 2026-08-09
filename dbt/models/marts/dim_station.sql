-- dim_station: gold dimension of monitoring stations.
select
    station_id,
    station_name,
    city,
    locality,
    country,
    latitude,
    longitude,
    sensors_count
from {{ ref('stg_stations') }}