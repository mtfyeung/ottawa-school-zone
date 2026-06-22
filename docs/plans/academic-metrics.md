# Add Academic Metrics to Ottawa School Zone (Revised)

Two new metrics based on verified, available data. Board-level metrics (credit accumulation, graduation rate, post-secondary pathway) dropped since all schools are OCDSB — same single value for every school adds no differentiation.

---

## Proposed Metrics

| # | Metric | Granularity | Display | In Composite Score? |
|---|--------|-------------|---------|---------------------|
| 1 | UW Adjustment Factor | Per-school (4-5 of ~25 secondary) | Detail modal, informational | No — too sparse |
| 2 | EQAO Academic Trend | Per-school (all schools) | Arrows on cards/table/modal | No — display only |

---

## Metric 1: University of Waterloo Adjustment Factor

**What it is:** The average grade drop between a student's high school admission average and their 1st-year UW Engineering GPA. Lower = school grades better predict university performance. Obtained via FIPPA requests.

**Coverage reality for OCDSB secondary schools (~25 schools):**

| School | Factor Range | Status |
|--------|-------------|--------|
| Bell HS | 10.7–11.4 | ✅ Specific value |
| Colonel By SS | 11.0–12.9 | ✅ Specific value |
| Earl of March SS | 9.3–11.5 | ✅ Specific value |
| Nepean HS | 8.8–10.9 | ✅ Specific value |
| Lisgar CI | ~12.8 (sporadic) | ⚠️ Intermittent |
| All other OCDSB secondary | ~14–16 (default) | Default value |

> [!NOTE]
> Schools with specific values (9-13% range) actually perform **better** than the default (~14-16%). Having a specific value itself is a signal — it means the school sends enough students to UW Engineering to generate data.

**Data source:** [GitHub - Waterloo-Adjustment-Factors](https://github.com/jdabtieu/Waterloo-Adjustment-Factors) — PDF files, latest is `AdjFactors2026.pdf`

### Changes

#### [NEW] `scripts/extract_waterloo_af.py`
- Download the latest PDF from the GitHub repo
- Use `pdfplumber` to parse the adjustment factor table
- Fuzzy-match school names to OCDSB secondary schools (or maintain a manual mapping dict for the ~4-5 known matches)
- Output structured data: `{school_name: {factor: float, is_default: bool, data_years: str}}`

#### [MODIFY] [download_data.py](file:///Users/mosa/src/ottawa-school-zone/scripts/download_data.py)
- Add download of the latest adjustment factor PDF from the GitHub repo

#### [MODIFY] [process_data.py](file:///Users/mosa/src/ottawa-school-zone/scripts/process_data.py)
- Import parsed UW AF data
- Merge into secondary school records
- Add field to each secondary school:
```json
"waterloo_af": {
  "factor": 10.7,
  "is_default": false,
  "data_years": "2017-2022"
}
```
- Schools without specific data get: `{"factor": 14.1, "is_default": true, ...}`

#### [MODIFY] [app.js](file:///Users/mosa/src/ottawa-school-zone/app.js)
- In the **detail modal** for secondary schools, add a "University Readiness" section:
  - Show the adjustment factor value with a horizontal gauge (lower = better, scale ~5-20)
  - Color coding: green (≤10), yellow (10-13), grey (default/14+)
  - Label: "UW Engineering Adjustment Factor: X%" 
  - Subtitle for specific values: "Based on [data_years] data from Y students"
  - Subtitle for default values: "Default value — insufficient data for this school"
  - Tooltip/info icon explaining what the factor means
- In the **comparison modal**, add a UW AF row for secondary school comparisons
- **Not** shown in cards or table view (too sparse for browsing)

#### [MODIFY] [index.css](file:///Users/mosa/src/ottawa-school-zone/index.css)
- Style the UW AF gauge in the detail modal
- Muted/dimmed style for default values vs. specific values

---

## Metric 2: EQAO Academic Trend (Display Only)

**What it is:** A computed indicator showing whether each school's EQAO scores are improving (↑), stable (→), or declining (↓) over available years. Answers: "Is this school getting better or worse?"

**Data source:** Already partially available — the Ontario Data Catalogue demographics files contain multi-year EQAO data. May also pull individual-year CSVs from [EQAO Open Data](https://www.eqao.com/open-data/) for cleaner year separation.

**Approach:** 
- Use per-year EQAO scores (at least 2-3 years needed)
- Compute simple linear slope per subject per school
- Classify: slope > +2 percentage points = "improving", slope < -2pp = "declining", else "stable"
- Aggregate subjects into overall math trend, literacy trend, and combined trend

### Changes

#### [MODIFY] [download_data.py](file:///Users/mosa/src/ottawa-school-zone/scripts/download_data.py)
- Verify that individual-year EQAO data is extractable from existing Ontario Data Catalogue files
- If not, add download of per-year EQAO CSV files from `eqao.com/open-data/`

#### [MODIFY] [process_data.py](file:///Users/mosa/src/ottawa-school-zone/scripts/process_data.py)
- After computing the 3-year EQAO averages (existing logic), also compute year-over-year trends
- Add trend computation function:
  ```python
  def compute_trend(yearly_values):
      """Returns 'improving', 'stable', or 'declining' based on linear slope."""
      if len(yearly_values) < 2:
          return None
      slope = (yearly_values[-1] - yearly_values[0]) / len(yearly_values)
      if slope > 0.02: return "improving"
      elif slope < -0.02: return "declining"
      else: return "stable"
  ```
- Add to each school record:
```json
"eqao_trend": {
  "math": "improving",
  "literacy": "stable",
  "overall": "improving"
}
```

#### [MODIFY] [app.js](file:///Users/mosa/src/ottawa-school-zone/app.js)
- **Grid view cards:** Show small trend arrow next to EQAO Math % and Literacy % values
  - `↑` green for improving, `→` grey for stable, `↓` red for declining
- **Table view:** Add trend arrows inline with Math Avg and Lit Avg columns
- **Detail modal:** Show trend arrows next to each EQAO subject bar, plus an "Academic Trajectory" summary line: "Overall: Improving ↑"
- **Map popups:** Add overall trend arrow next to the EQAO average value
- **Comparison modal:** Add trend indicators in the EQAO section

#### [MODIFY] [index.css](file:///Users/mosa/src/ottawa-school-zone/index.css)
- Trend arrow styles: `.trend-up { color: var(--success-color); }`, `.trend-down { color: var(--danger-color); }`, `.trend-stable { color: var(--text-muted); }`
- Small font size, positioned inline with the score values

---

## Verification Plan

### Data Pipeline
```bash
cd /Users/mosa/src/ottawa-school-zone

# Download new data sources
python scripts/download_data.py

# Parse UW AF PDF
python scripts/extract_waterloo_af.py

# Process all data
python scripts/process_data.py

# Verify new fields in output JSON
python -c "
import json
data = json.load(open('data/schools_data.json'))
sec = [s for s in data if s['level'] == 'Secondary']
print(f'Secondary schools: {len(sec)}')
print(f'With specific UW AF: {sum(1 for s in sec if not s.get(\"waterloo_af\", {}).get(\"is_default\", True))}')
print(f'With EQAO trend: {sum(1 for s in sec if s.get(\"eqao_trend\"))}')
elem = [s for s in data if s['level'] == 'Elementary']
print(f'Elementary with EQAO trend: {sum(1 for s in elem if s.get(\"eqao_trend\"))}')
"
```

### Manual Verification
- Open app locally and verify:
  - Detail modal for Bell HS / Colonel By / Earl of March / Nepean shows specific UW AF values with green/yellow gauge
  - Detail modal for other secondary schools shows default value with dimmed/grey treatment
  - EQAO trend arrows appear on cards, table rows, and detail modal
  - Trend arrows are colored correctly (green ↑, grey →, red ↓)
  - Comparison modal includes UW AF row and trend indicators
  - No visual regressions on existing UI
