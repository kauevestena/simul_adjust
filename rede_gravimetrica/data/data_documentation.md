# Data Documentation

This document describes the datasets generated for the scientific gravimetric network in the state of Paraná, Brazil, based on the reference thesis.

## Files

### 1. `rede_gravimetrica/data/cities.csv`
Contains the list of cities and locations mentioned in the thesis.
- **City Name:** Name of the city/station.
- **Latitude:** Geocoded latitude (decimal degrees).
- **Longitude:** Geocoded longitude (decimal degrees).

### 2. `rede_gravimetrica/data/absolute_gravity.csv`
Contains the absolute gravity values for stations in the network, combining both the RENEGA fundamental stations and the adjusted values from the final `AJUSTAMENTOINTEGRADO` solution.
- **City Name:** Name of the city/station.
- **Latitude:** Geocoded latitude (decimal degrees).
- **Longitude:** Geocoded longitude (decimal degrees).
- **Absolute Gravimetric Value (mGal):** The absolute gravity value in milliGals.
- **to_use:** A boolean flag (`True`/`False`). Only set to `True` for `Curitiba` and `Valinhos`, the fundamental absolute stations used to constrain the network adjustment.

### 3. `rede_gravimetrica/data/gravimetric_lines.csv`
Defines the relative gravimetric observations forming the micro-circuits of the network.
- **line name:** Identifier for the observation line (e.g., "01", "14a").
- **city from:** Origin station name.
- **city to:** Destination station name.
- **relative gravimetric value (mGal):** The calculated difference in gravity between the destination and origin stations. Left blank if no absolute gravity data was available for calculation.
- **equipment:** The equipment used for the measurement populated based on integrated adjustment metadata.
- **weight:** The statistical weight of the observation in the network adjustment populated based on integrated adjustment metadata.

## Quality Report

For a detailed analysis of the precision and reliability of the data (specifically the `AJUSTAMENTOINTEGRADO` solution), please refer to `rede_gravimetrica/data/quality_report.md`.
