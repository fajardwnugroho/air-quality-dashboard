-- dim_location: canonical city list for the 7 monitored Indonesian cities,
-- attributed with province + region for geographic grouping in the dashboard.
with target_cities as (
    select
        'Jakarta'   as city, 'DKI Jakarta'  as province, 'Java'              as region
    union all select 'Bandung',   'West Java',      'Java'
    union all select 'Surabaya',  'East Java',      'Java'
    union all select 'Medan',     'North Sumatra',  'Sumatra'
    union all select 'Denpasar',  'Bali',           'Bali & Nusa Tenggara'
    union all select 'Yogyakarta','Special Region of Yogyakarta', 'Java'
    union all select 'Semarang',  'Central Java',   'Java'
)
select
    city,
    province,
    region
from target_cities