library(testthat)

test_that("ispu_from_value maps pm25 breakpoints", {
  expect_equal(ispu_from_value("pm25", 0), 0)
  expect_equal(ispu_from_value("pm25", 15.4), 50)
  expect_equal(ispu_from_value("pm25", 55.4), 100)
  expect_equal(ispu_from_value("pm25", 250.5), 301)
  expect_equal(ispu_from_value("pm25", 600), 500)
})

test_that("unknown pollutant returns NA", {
  expect_true(is.na(ispu_from_value("so2", 10)))
})

test_that("ispu_category labels breakpoints", {
  expect_equal(as.character(ispu_category(25)), "Baik")
  expect_equal(as.character(ispu_category(75)), "Sedang")
  expect_equal(as.character(ispu_category(150)), "Tidak Sehat")
  expect_equal(as.character(ispu_category(250)), "Sangat Tidak Sehat")
  expect_equal(as.character(ispu_category(450)), "Berbahaya")
})