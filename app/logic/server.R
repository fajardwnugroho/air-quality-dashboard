library(shiny)
library(dplyr)
library(ggplot2)
library(DT)

source(file.path("logic", "data.R"), local = TRUE)
source(file.path("logic", "aqi.R"), local = TRUE)

server <- function(input, output, session) {
  cfg <- .get_db_url()
  con <- reactiveVal(NULL)
  onStop(function() if (!is.null(con())) DBI::dbDisconnect(con()))

  observe({
    c <- NULL
    # Lazy connection: fail softly so the app still renders shell on empty DB.
    tryCatch(
      c <- .connect(cfg),
      error = function(e) showNotification(paste("DB unavailable:", e$message), type = "warning")
    )
    if (!is.null(c)) con(c)
  })

  # ---- Live hero -------------------------------------------------------
  current <- reactive({
    req(con())
    tryCatch(read_current(con()), error = function(e) data.frame())
  })

  output$ispu_hero <- renderUI({
    df <- current()
    if (!nrow(df)) return(p("No data yet — run the pipeline first.", class = "text-muted"))
    df <- best_current(df)
    df <- df[order(-df$ispu), ]
    if (nrow(df) > 0) {
      best <- df[1, ]
      tagList(
        h2(paste0(best$ispu, " · ", as.character(best$category))),
        p(paste0("Worst pollutant: ", toupper(best$pollutant), " (", round(best$value, 1), " ", best$unit, ") in ", best$city))
      )
    } else {
      p("No valid readings.")
    }
  })

  output$current_plot <- renderPlot({
    df <- current()
    req(nrow(df) > 0)
    df <- df[df$city == input$city & df$pollutant == input$pollutant, , drop = FALSE]
    if (!nrow(df)) return(ggplot() + ggtitle("No data for selection"))
    ggplot(df, aes(x = city, y = value)) +
      geom_col(fill = "#0d6efd") +
      labs(y = paste0(input$pollutant, " (", unique(df$unit)[1], ")"), x = NULL) +
      theme_minimal()
  })

  # ---- Trends ----------------------------------------------------------
  daily <- reactive({
    req(con())
    tryCatch(read_daily(con()), error = function(e) data.frame())
  })

  output$trend_plot <- renderPlot({
    df <- daily()
    req(nrow(df) > 0)
    df <- df[df$pollutant == input$trend_pollutant, , drop = FALSE]
    if (nrow(df) == 0) return(ggplot() + ggtitle("No data for selection"))
    df <- df[df$city %in% input$trend_cities, , drop = FALSE]
    df$date_day <- as.Date(df$date_day)
    ggplot(df, aes(x = date_day, y = avg_value, color = city)) +
      geom_line() +
      geom_point(alpha = 0.4) +
      scale_x_date(date_labels = "%b %d") +
      labs(
        x = NULL, y = paste0(input$trend_pollutant, " (daily avg)"),
        title = paste0("Daily ", toupper(input$trend_pollutant), " by city")
      ) +
      theme_minimal()
  })

  # ---- Station comparison ---------------------------------------------
  comparison <- reactive({
    req(con())
    tryCatch(read_comparison(con()), error = function(e) data.frame())
  })

  output$comparison_table <- renderDT({
    df <- comparison()
    req(nrow(df) > 0)
    df <- df[df$city %in% input$trend_cities, , drop = FALSE]
    df$measured_at_utc <- as.character(df$measured_at_utc)
    datatable(df, options = list(pageLength = 25, scrollX = TRUE))
  })

  # ---- Anomalies -------------------------------------------------------
  anomalies <- reactive({
    req(con())
    tryCatch(read_anomalies(con()), error = function(e) data.frame())
  })

  output$anomaly_table <- renderDT({
    df <- anomalies()
    req(nrow(df) > 0)
    df$z_score <- round(df$z_score, 2)
    df$date_day <- as.character(df$date_day)
    datatable(df, options = list(pageLength = 25, scrollX = TRUE))
  })

  # ---- Data health -----------------------------------------------------
  output$health <- renderUI({
    if (is.null(con())) {
      return(p("Database connection is not available.", class = "text-warning"))
    }
    meta <- tryCatch(
      DBI::dbGetQuery(con(), "SELECT key, last_update, record_count FROM serving.ingestion_metadata"),
      error = function(e) data.frame()
    )
    if (!nrow(meta)) {
      return(p("No freshness metadata yet.", class = "text-muted"))
    }
    tagList(
      h4("Pipeline freshness"),
      renderPrint({
        meta
      })
    )
  })
}