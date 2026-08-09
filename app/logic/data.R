# logic/data.R — read-only access to the Air Quality serving layer.
#
# Primary source: Supabase Postgres (`serving` schema) via SUPABASE_DB_URL or
# CLIENT_DB_URL. For local / pipeline debugging it can fall back to reading the
# DuckDB warehouse read-only when no Postgres URL is configured.

.get_db_url <- function() {
  url <- Sys.getenv("SUPABASE_DB_URL", Sys.getenv("CLIENT_DB_URL", ""))
  if (nzchar(url)) return(list(engine = "postgres", url = url))
  duckdb_path <- Sys.getenv("DUCKDB_PATH", "data/air_quality.duckdb")
  list(engine = "duckdb", path = duckdb_path)
}

.parse_pg_url <- function(url) {
  u <- urltools::url_parse(url)
  list(
    host = u$domain,
    port = if (nzchar(u$port)) as.integer(u$port) else 5432L,
    dbname = sub("^/", "", u$path),
    user = u$username,
    password = urltools::url_decode(u$password)
  )
}

.connect <- function(cfg) {
  if (cfg$engine == "postgres") {
    p <- .parse_pg_url(cfg$url)
    DBI::dbConnect(
      RPostgres::Postgres(),
      host = p$host, port = p$port, dbname = p$dbname,
      user = p$user, password = p$password, sslmode = "require"
    )
  } else {
    DBI::dbConnect(duckdb::duckdb(), dbdir = cfg$path, read_only = TRUE)
  }
}

.db <- function(con, sql, params = NULL) {
  if (inherits(con, "PqConnection")) {
    DBI::dbGetQuery(con, sql, params = params)
  } else {
    DBI::dbGetQuery(con, sql, params = params)
  }
}

#' Latest reading per city + pollutant (powers the live hero).
read_current <- function(con, cities = NULL, pollutants = NULL) {
  sql <- "SELECT city, pollutant, value, unit, measured_at_utc
          FROM serving.mart_air_quality_current"
  df <- .db(con, sql)
  if (!is.null(cities)) df <- df[df$city %in% cities, ]
  if (!is.null(pollutants)) df <- df[df$pollutant %in% pollutants, ]
  df
}

#' Daily averages for the trend chart.
read_daily <- function(con, cities = NULL, pollutants = NULL, from = NULL, to = NULL) {
  sql <- "SELECT city, pollutant, date_day, avg_value, min_value, max_value
          FROM serving.mart_air_quality_daily"
  df <- .db(con, sql)
  if (!is.null(from)) df <- df[df$date_day >= as.Date(from), ]
  if (!is.null(to)) df <- df[df$date_day <= as.Date(to), ]
  if (!is.null(cities)) df <- df[df$city %in% cities, ]
  if (!is.null(pollutants)) df <- df[df$pollutant %in% pollutants, ]
  df
}

#' Latest per-station values for the station comparison view.
read_comparison <- function(con, cities = NULL, pollutants = NULL) {
  sql <- "SELECT station_id, station_name, city, pollutant, value, unit, measured_at_utc
          FROM serving.mart_station_comparison"
  df <- .db(con, sql)
  if (!is.null(cities)) df <- df[df$city %in% cities, ]
  if (!is.null(pollutants)) df <- df[df$pollutant %in% pollutants, ]
  df
}

#' Recent anomalies.
read_anomalies <- function(con, cities = NULL, pollutants = NULL) {
  sql <- "SELECT city, pollutant, date_day, avg_value, baseline_mean, z_score
          FROM serving.mart_pollution_anomalies"
  df <- .db(con, sql)
  if (!is.null(cities)) df <- df[df$city %in% cities, ]
  if (!is.null(pollutants)) df <- df[df$pollutant %in% pollutants, ]
  df
}