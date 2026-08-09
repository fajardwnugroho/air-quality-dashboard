# app.R — canonical entry point for the Air Quality dashboard.
# Required by shiny::runApp('.') and Shiny Server: the app root must expose
# app.R (or server.R + ui.R). Mirrors main.R (kept for rhino::run_dev).
#
# Run with: Rscript app.R   (or shiny::runApp('.'))

library(shiny)

ui <- source(file.path("view", "ui.R"))$value
server <- source(file.path("logic", "server.R"))$value

shiny::shinyApp(ui = ui, server = server)