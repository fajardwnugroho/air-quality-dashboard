library(shiny)
library(bslib)
library(DT)

ui <- page_navbar(
  title = span(
    tags$i(class = "fa-solid fa-wind me-2"),
    "Air Quality Indonesia"
  ),
  theme = bs_theme(
    bootswatch = "flatly",
    primary = "#0B6E4F",
    base_font = font_google("Inter"),
    heading_font = font_google("Inter"),
    font_scale = 1.0
  ),
  window_title = "Air Quality Indonesia",
  selected = "Live",

  nav_panel(
    "Live",
    uiOutput("freshness_badge"),
    uiOutput("ispu_cards"),
    layout_columns(
      col_widths = c(4, 8),
      card(
        full_screen = TRUE,
        card_header("ISPU by city"),
        plotOutput("ischart", height = "340px")
      ),
      card(
        full_screen = TRUE,
        card_header("Station comparison"),
        DTOutput("comparison_table")
      )
    )
  ),

  nav_panel(
    "Trends",
    layout_columns(
      col_widths = c(3, 9),
      card(
        card_header("Filters"),
        selectizeInput(
          "trend_cities", "Cities",
          choices = character(0), multiple = TRUE
        ),
        selectInput("trend_pollutant", "Pollutant", choices = character(0)),
        dateRangeInput(
          "trend_range", "Range",
          start = Sys.Date() - 14, end = Sys.Date()
        ),
        downloadButton("download_daily", "Download CSV", class = "mt-2")
      ),
      card(
        full_screen = TRUE,
        card_header("Daily concentration"),
        plotOutput("trend_plot", height = "360px")
      )
    )
  ),

  nav_panel(
    "Anomalies",
    card(
      full_screen = TRUE,
      card_header("Pollution anomalies (z-score vs rolling baseline)"),
      DTOutput("anomaly_table")
    )
  )

)