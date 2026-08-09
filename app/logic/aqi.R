# logic/aqi.R — Indonesia-standard air quality index (ISPU) computation.
#
# Based on the Indonesian Ministry of Environment regulation (PP No. 22/2021),
# the same breakpoints KLHK uses for PM2.5, PM10, SO2, CO, O3, and NO2.

ispu_breakpoints <- list(
  pm25 = data.frame(
    c_min = c(0, 15.5, 55.5, 150.5, 250.5),
    c_max = c(15.4, 55.4, 150.4, 250.4, 500.4),
    i_min = c(0, 51, 101, 201, 301),
    i_max = c(50, 100, 200, 300, 500)
  ),
  pm10 = data.frame(
    c_min = c(0, 50, 150, 350, 420),
    c_max = c(49, 149, 349, 419, 500),
    i_min = c(0, 51, 101, 201, 301),
    i_max = c(50, 100, 200, 300, 500)
  ),
  o3 = data.frame(
    c_min = c(0, 120, 235, 400, 800),
    c_max = c(119, 234, 399, 799, 1000),
    i_min = c(0, 51, 101, 201, 301),
    i_max = c(50, 100, 200, 300, 500)
  ),
  no2 = data.frame(
    c_min = c(0, 80, 200, 1130, 2260),
    c_max = c(79, 199, 1129, 2259, 3000),
    i_min = c(0, 51, 101, 201, 301),
    i_max = c(50, 100, 200, 300, 500)
  )
)

ispu_category <- function(x) {
  factor(
    findInterval(x, c(-Inf, 50, 100, 200, 300, Inf)),
    levels = 1:5,
    labels = c("Baik", "Sedang", "Tidak Sehat", "Sangat Tidak Sehat", "Berbahaya")
  )
}

#' Compute ISPU for a pollutant concentration.
ispu_from_value <- function(pollutant, value) {
  stops <- ispu_breakpoints[[pollutant]]
  if (is.null(stops)) return(NA_real_)
  sapply(value, function(v) {
    if (is.na(v)) return(NA_real_)
    row <- which(stops$c_min <= v & v <= stops$c_max)
    if (length(row) == 0) {
      if (v < stops$c_min[1]) return(0)
      return(500) # above the last breakpoint → hazardous ceiling
    }
    b <- stops[row[1], ]
    round(b$i_min + ((b$i_max - b$i_min) / (b$c_max - b$c_min)) * (v - b$c_min))
  })
}

#' Highest ISPU across pollutants for a location snapshot.
best_current <- function(df) {
  df$ispu <- mapply(ispu_from_value, df$pollutant, df$value)
  df$category <- ispu_category(df$ispu)
  df
}