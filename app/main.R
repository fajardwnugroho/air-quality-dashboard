# main.R — entry point for the Air Quality dashboard.
# Follows the Rhino convention: UI lives in view/, logic in logic/.
# Run with: rhino::run_dev()  (or Rscript main.R)

library(shiny)

ui <- source(file.path("view", "ui.R"))$value
server <- source(file.path("logic", "server.R"))$value

shiny::shinyApp(ui = ui, server = server)