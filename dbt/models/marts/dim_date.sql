-- dim_date: day-level date dimension derived from measurement history.
select
    date(measured_at_utc) as date_day,
    extract(year from measured_at_utc)  as year,
    extract(month from measured_at_utc) as month,
    extract(day from measured_at_utc)   as day,
    dayname(measured_at_utc) as day_name,
    extract(week from measured_at_utc) as week_of_year
from {{ ref('int_measurements_hourly') }}
group by date(measured_at_utc),
         extract(year from measured_at_utc),
         extract(month from measured_at_utc),
         extract(day from measured_at_utc),
         dayname(measured_at_utc),
         extract(week from measured_at_utc)