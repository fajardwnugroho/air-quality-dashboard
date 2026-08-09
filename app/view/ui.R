library(shiny)
library(bslib)
library(DT)

CITIES <- c("Jakarta", "Bandung", "Surabaya", "Medan", "Denpasar", "Yogyakarta", "Semarang")
POLLUTANTS <- c("pm25", "pm10", "o3", "no2")

ui <- page_navbar(
  title = "Air Quality Indonesia",
  theme = bs_theme(bootswatch = "flatly", primary = "#0d6efd"),
  selected = "Live",

  nav_panel(
    "Live",
    layout_columns(
      col_widths = c(3, 9),
      card(
        card_header("Filters"),
        selectInput("city", "City", choices = CITIES, selected = "Jakarta"),
        selectInput("pollutant", "Pollutant", choices = POLLUTANTS, selected = "pm25")
      ),
      card(
        card_header("Current ISPU"),
        uiOutput("ispu_hero"),
        plotOutput("current_plot", height = "300px")
      )
    )
  ),

  nav_panel(
    "Trends",
    layout_columns(
      col_widths = c(3, 9),
      card(
        card_header("Filters"),
        selectizeInput("trend_cities", "Cities", choices = CITIES, selected = CITIES, multiple = TRUE),
        selectInput("trend_pollutant", "Pollutant", choices = POLLUTANTS, selected = "pm25"),
        dateRangeInput("trend_range", "Range", start = Sys.Date() - 14, end = Sys.Date())
      ),
      card(card_header("Daily concentration"), plotOutput("trend_plot", height = "320px"))
    )
  ),

  nav_panel(
    "Station Comparison",
    card(
      card_header("Latest readings by station"),
      DTOutput("comparison_table")
    )
  ),

  nav_panel(
    "Anomalies",
    card(
      card_header("Pollution anomalies (z-score vs rolling baseline)"),
      DTOutput("anomaly_table")
    )
  ),

  nav_panel(
    "Data Health",
    card(card_header("Pipeline freshness"), htmlOutput("health"))
  )
)