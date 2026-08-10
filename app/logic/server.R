library(shiny)
library(dplyr)
library(ggplot2)
library(DT)

source(file.path("logic", "data.R"), local = TRUE)
source(file.path("logic", "aqi.R"), local = TRUE)

server <- function(input, output, session) {
  cfg <- .get_db_url()
  con <- reactiveVal(NULL)
  onStop(function() if (!is.null(isolate(con()))) DBI::dbDisconnect(isolate(con())))

  observe({
    c <- NULL
    # Lazy connection: fail softly so the app still renders shell on empty DB.
    tryCatch(
      c <- .connect(cfg),
      error = function(e) showNotification(paste("DB unavailable:", e$message), type = "warning")
    )
    if (!is.null(c)) con(c)
  })

  # ---- Shared reads -----------------------------------------------------
  current <- reactive({
    req(con())
    tryCatch(read_current(con()), error = function(e) data.frame())
  })

  daily <- reactive({
    req(con())
    tryCatch(read_daily(con()), error = function(e) data.frame())
  })

  comparison <- reactive({
    req(con())
    tryCatch(read_comparison(con()), error = function(e) data.frame())
  })

  # ---- Data-driven filter choices --------------------------------------
  observe({
    df <- current()
    av_cities <- unique(df$city)
    av_poll <- unique(df$pollutant)
    if (!length(av_poll)) av_poll <- "pm25"
    updateSelectizeInput(session, "trend_cities",
      choices = av_cities, selected = head(av_cities, 5), server = TRUE)
    updateSelectInput(session, "trend_pollutant",
      choices = av_poll, selected = av_poll[1])
  })

  # ---- Freshness badge --------------------------------------------------
  output$freshness_badge <- renderUI({
    if (is.null(con())) {
      return(div(class = "alert alert-warning", "Database connection not available."))
    }
    meta <- tryCatch(
      DBI::dbGetQuery(con(), "SELECT key, last_update, record_count FROM serving.ingestion_metadata"),
      error = function(e) data.frame()
    )
    df <- current()
    if (!nrow(meta) && !nrow(df)) {
      return(div(class = "alert alert-secondary", "No data yet — waiting for first pipeline run."))
    }
    if (!nrow(df)) return(div(class = "alert alert-secondary", "No live readings yet."))
    latest <- max(as.POSIXct(df$measured_at_utc, tz = "UTC"), na.rm = TRUE)
    age <- as.numeric(difftime(Sys.time(), latest, units = "mins"))
    badge_txt <- if (is.finite(age) && age > 120) {
      span(class = "badge text-bg-danger", "stale")
    } else {
      span(class = "badge text-bg-success", "up to date")
    }
    div(
      class = "d-flex justify-content-between align-items-center mb-2",
      div(
        span(class = "text-muted small",
          sprintf("Measurements updated %s ago", fmt_age(age))),
        badge_txt
      ),
      div(class = "text-muted small",
        sprintf("%d cities · %s",
          length(unique(df$city)),
          paste(unique(df$pollutant), collapse = ", "))
      )
    )
  })

  # ---- ISPU hero cards --------------------------------------------------
  ispu_flat <- reactive({
    df <- current()
    req(nrow(df) > 0)
    score <- best_current(df)
    score
  })

  severity_colors <- c(
    Baik = "#2E7D32", Sedang = "#F9A825",
    `Tidak Sehat` = "#EF6C00",
    `Sangat Tidak Sehat` = "#D32F2F", Berbahaya = "#7B1FA2"
  )

  output$ispu_cards <- renderUI({
    score <- ispu_flat()
    req(!is.null(score) && nrow(score) > 0)
    rows <- split(score, score$city)
    cards <- lapply(names(rows), function(city) {
      x <- rows[[city]]
      worst <- x[which.max(x$ispu), ]
      col <- unname(severity_colors[as.character(worst$category)])
      if (is.na(col)) col <- "#6B7280"
      div(
        class = "card h-100 shadow-sm",
        style = sprintf("border-left: 6px solid %s;", col),
        div(class = "card-body", style = "padding: 1rem;",
          div(class = "d-flex justify-content-between align-items-start",
            h5(class = "card-title mb-0", city),
            span(class = "badge", style = sprintf("background-color: %s; color: #fff;", col),
              as.character(worst$category))
          ),
          div(class = "mt-3 d-flex align-items-baseline",
            h2(class = "mb-0 fw-bold", style = sprintf("color: %s;", col), worst$ispu),
            span(class = "text-muted small ms-2", "ISPU")
          ),
          p(class = "text-muted small mb-0 mt-2",
            sprintf("%s · %.1f %s", toupper(worst$pollutant), worst$value, worst$unit))
        )
      )
    })
    layout_columns(col_widths = rep(3, length.out = length(cards)), !!!cards)
  })

  # ---- ISPU bar chart ---------------------------------------------------
  output$ischart <- renderPlot({
    score <- ispu_flat()
    req(nrow(score) > 0)
    worst <- score[order(-score$ispu), ]
    worst$city <- factor(worst$city, levels = rev(unique(worst$city)))
    worst$fill <- severity_colors[as.character(worst$category)]
    ggplot(worst, aes(x = city, y = ispu, fill = fill)) +
      geom_col(width = 0.7) +
      geom_text(aes(label = ispu), hjust = -0.2, size = 5, fontface = "bold") +
      scale_y_continuous(limits = c(0, max(500, max(worst$ispu) * 1.2)), expand = c(0, 0)) +
      scale_fill_identity() +
      coord_flip() +
      labs(x = NULL, y = "ISPU", title = "Worst ISPU by city") +
      theme_minimal(base_size = 15) +
      theme(plot.title = element_text(hjust = 0.5, face = "bold"),
            panel.grid.major.y = element_blank())
  })

  # ---- Trends -----------------------------------------------------------
  output$trend_plot <- renderPlot({
    df <- daily()
    req(nrow(df) > 0)
    df <- df[df$pollutant == input$trend_pollutant, , drop = FALSE]
    if (nrow(df) == 0) return(ggplot() + ggtitle("No data for selection"))
    df <- df[df$city %in% input$trend_cities, , drop = FALSE]
    df$date_day <- as.Date(df$date_day)
    if (nrow(df) == 0) return(ggplot() + ggtitle("No data for selection"))
    ggplot(df, aes(x = date_day, y = avg_value, color = city)) +
      geom_line(linewidth = 1.1) +
      geom_point(alpha = 0.4) +
      scale_x_date(date_labels = "%b %d") +
      labs(
        x = NULL, y = paste0(input$trend_pollutant, " (daily avg)"),
        title = paste0("Daily ", toupper(input$trend_pollutant), " by city")
      ) +
      theme_minimal(base_size = 14) +
      theme(plot.title = element_text(face = "bold"))
  })

  output$download_daily <- downloadHandler(
    filename = function() paste0("daily_", Sys.Date(), ".csv"),
    content = function(file) {
      df <- daily()
      if (!nrow(df)) return(write.csv(data.frame(), file))
      if (nzchar(input$trend_pollutant)) df <- df[df$pollutant == input$trend_pollutant, , drop = FALSE]
      if (!is.null(input$trend_cities)) df <- df[df$city %in% input$trend_cities, , drop = FALSE]
      write.csv(df, file, row.names = FALSE)
    }
  )

  # ---- Station comparison ----------------------------------------------
  output$comparison_table <- renderDT({
    df <- comparison()
    req(nrow(df) > 0)
    df <- df[df$city %in% input$trend_cities, , drop = FALSE]
    df$measured_at_utc <- as.character(df$measured_at_utc)
    datatable(df, options = list(pageLength = 10, scrollX = TRUE), rownames = FALSE)
  })

  # ---- Anomalies --------------------------------------------------------
  output$anomaly_table <- renderDT({
    df <- tryCatch(read_anomalies(con()), error = function(e) data.frame())
    req(nrow(df) > 0)
    df$z_score <- round(df$z_score, 2)
    df$date_day <- as.character(df$date_day)
    datatable(df, options = list(pageLength = 25, scrollX = TRUE), rownames = FALSE)
  })
}

# ---- helpers -------------------------------------------------------------
fmt_age <- function(mins) {
  if (!is.finite(mins)) return("unknown")
  if (mins < 1) return("< 1 min")
  if (mins < 60) return(sprintf("%.0f min", mins))
  sprintf("%.1f hrs", mins / 60)
}