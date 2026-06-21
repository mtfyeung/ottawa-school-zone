# Ottawa School Zone Analyzer (OCDSB)

An interactive, data-driven dashboard to evaluate and rank all ~120+ Ottawa-Carleton District School Board (OCDSB) schools. This tool helps families moving to Ottawa evaluate school catchments based on academics, capacity health, French program offerings, and socio-economic demographics.

## Data Sources

All data used in this dashboard is sourced from verified public repositories:
1. **Ontario Open Data Portal (`data.ontario.ca`)**:
   - *Public School Contact Information (May 2026)*: School names, addresses, websites, phone numbers, and grade structures.
   - *School Information & Student Demographics (2022–2025)*: Enrolment, socio-economic factors (low-income percentages, parents with no degree), and detailed student needs (ESL/ELL, Special Ed, Gifted).
   - *French as a Second Language Programs List (2024–2025)*: Tracks whether schools offer Core French, Extended French, or French Immersion.
2. **Education Quality and Accountability Office (EQAO) Open Data**:
   - 3-year averages (2022–2025) of Grade 3 & 6 Reading, Writing, Math standard achievements, Grade 9 Math, and Grade 10 OSSLT literacy pass rates.
3. **OCDSB eSCRIBE public archives**:
   - *Elementary Program Review (Report 25-016)*: On-The-Ground (OTG) capacity slots and utilization rates for all elementary schools.

## Features

- **Adjustable Weighting System**: Sliders let you set custom weights for Academics, Capacity Health, French Programs, and Community demographics. The rankings update live.
- **Capacity Health Evaluator**: Highlights the "sweet spot" (85–100% capacity) and flags overcrowded or underutilized elementary schools.
- **Shortlist Comparison Matrix**: Select up to 4 schools and compare them side-by-side on all academic, capacity, program, and demographic details.
- **Filters**: Quickly filter by school level (Elementary/Secondary), FSL programs (French Immersion, Extended French), and Rank Tiers.

## How to Run Locally

Since this dashboard fetches `data/schools_data.json` dynamically, browsers block requests when opened directly via the `file://` scheme due to CORS restrictions. To view the dashboard, serve the folder using a local web server:

### Option 1: Python (Recommended)
If you have Python installed, run this command in your terminal:
```bash
python3 -m http.server 8000
```
Then open your browser and navigate to:
[http://localhost:8000](http://localhost:8000)

### Option 2: Node.js (npx)
If you have Node.js installed, run:
```bash
npx serve
```
Then open the URL printed in the terminal (usually `http://localhost:3000` or `http://localhost:5000`).

## Folder Structure

- `data/`
  - `schools_data.json` - Combined and processed data for all schools.
  - `elementary_capacity.csv` - Extracted capacity data from OCDSB Report 25-016.
  - Raw datasets downloaded from Ontario Open Data.
- `scripts/`
  - `download_data.py` - Script to fetch latest XLSX files from the Ontario Data Catalogue.
  - `extract_capacity.py` - Python script to parse eSCRIBE PDF and extract tables.
  - `process_data.py` - Script to clean, align names, average EQAO, and export JSON.
- `index.html` - Premium responsive HTML interface.
- `index.css` - Custom glassmorphic dark-theme design stylesheet.
- `app.js` - Score weighting algorithm and interface control script.
