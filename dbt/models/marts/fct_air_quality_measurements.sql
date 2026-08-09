-- fct_air_quality_measurements: hourly fact table joining hourly measurements
-- with station + city context. The base table for all mart_* aggregates.

select
    h.station_id,
    st.station_name,
    st.city,
    st.latitude,
    st.longitude,
    h.pollutant,
    h.measured_at_utc,
    h.value,
    h.unit,
    h.reading_count
from {{ ref('int_measurements_hourly') }} h
left join {{ ref('stg_stations') }} st
    on h.station_id = st.station_id