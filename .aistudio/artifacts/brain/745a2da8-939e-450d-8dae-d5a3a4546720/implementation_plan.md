# Multi-Tank Dip Reading Form & Density Removal

Comprehensive redesign of the Dip Reading workflow: removes redundant density check fields, introduces a unified all-tanks entry card layout, and provides instant dip-chart auto-calculation for each tank.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Layout**: All tanks shown together in a clean card list inside the modal (no dropdowns or tedious one-by-one entries).
> - **Inputs**: Both **Dip Reading (cm)** and **Litres** inputs for each tank, with real-time automatic litres calculation if the tank has a dip chart configured.
> - **Metadata**: Single shared date (time and shared note removed as requested for faster, streamlined entry).
> - **Density Removal**: Completely removed all density check inputs (`Measured`, `Temp °C`, `At 15 °C`) from this form to eliminate clutter and redundancy with the statutory Density Register.

---

## 1. Overview & Core Concept

### What It Does
- **All-Tanks Single-Action Logging**: Displays all configured storage tanks (e.g., Tank 1 MS, Tank 2 HSD, Tank 3 Power) in a clean, vertical card list.
- **Dip-Chart Auto-Calculation**: As the operator enters the dip reading in centimeters (`cm`), the app automatically looks up and linear-interpolates the volume in litres using the tank's calibration chart and populates the litres field instantly.
- **Direct Litres Override**: If a tank does not have a digital chart configured or the operator reads directly from a physical laminated dip chart, they can directly type the litres.
- **Streamlined Date Selection**: Simple single date selector without time or note clutter.
- **Clean Density Boundary**: All density logging remains focused exclusively in the statutory Density Register (`+ Morning Density`, `+ Tanker Decantation`), keeping the Dip Reading form fast, lightweight, and focused purely on physical stock.

---

## 2. Visual Architecture & Layout Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│ Add Dip Reading                                                    [✕] │
│ Record physical dip levels for all underground storage tanks.          │
├────────────────────────────────────────────────────────────────────────┤
│ Reading Date: [ 2026-10-17 ▾ ]                                         │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ Tank 1 · Petrol (MS) ───────────────────────── Capacity: 20,000 L ┐ │
│ │ Last recorded: 14,250 L (145.2 cm) on 16 Oct, 07:30                │ │
│ │                                                                    │ │
│ │ Dip Reading (cm): [ 146.5      ]  Litres: [ 14,380 L (Auto)      ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Tank 2 · Diesel (HSD) ──────────────────────── Capacity: 20,000 L ┐ │
│ │ Last recorded: 8,920 L (98.0 cm) on 16 Oct, 07:30                  │ │
│ │                                                                    │ │
│ │ Dip Reading (cm): [ 102.0      ]  Litres: [ 9,340 L (Auto)       ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Tank 3 · Power Petrol ──────────────────────── Capacity: 15,000 L ┐ │
│ │ Last recorded: 6,400 L (72.5 cm) on 16 Oct, 07:30                  │ │
│ │                                                                    │ │
│ │ Dip Reading (cm): [            ]  Litres: [                      ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Total Dip Volume: 23,720 L across 2 tanks entered                      │
│                                                                        │
│ [ Cancel ]                                   [ Save All Dip Readings ] │
└────────────────────────────────────────────────────────────────────────┘
```

- **Styling Discipline**:
  - Native card containers (`var(--card)`) with `1px solid var(--line)`.
  - Fuel product badges (`MS`, `HSD`, `Power`) matching app tokens.
  - Tabular figures (`tabular-nums`) for clean number comparison.

---

## 3. Data Model & Backend Architecture

### API Update in `server.js`
- Enhance `POST /api/dips`:
  - Support batch payload:
    ```json
    {
      "date": "2026-10-17",
      "time": "07:30",
      "note": "Morning dip audit",
      "readings": [
        { "tank_id": "1792063491275", "dip": 146.5, "litres": 14380 },
        { "tank_id": "1792063500115", "dip": 102.0, "litres": 9340 }
      ]
    }
    ```
  - Inserts all readings in a single atomic database transaction.
  - Preserves backward compatibility for worker single-tank dip submissions (`TK.mine`).
  - Audits batch dip entry with total tanks recorded.

---

## 4. Implementation Steps (Planned for Execution Upon Approval)

1. **Backend Batch Handler in `server.js`**:
   - Update `app.post("/api/dips")` to accept `readings: [...]` array with shared date/time/note or single tank object.
   - Run in SQLite transaction and validate capacity bounds.

2. **Frontend Multi-Tank Modal in `public/index.html`**:
   - Replace old `dipFields()` and `dipForm()` with `dipForm(preTankId)`.
   - Remove density input fields (`td1`, `td2`, `td3`).
   - Render clean card for each active tank in `S.tanks`.
   - Add real-time `oninput` handler on dip (cm) input that uses `fromChart(tank.chart, dip)` on the client side to immediately populate litres.
   - Live summary bar showing total recorded physical volume across all tanks.
   - Batch submit handler `saveAllDips()` that sends all entered tanks, toasts success, and refreshes DSR stock checks.

3. **Verification**:
   - Test simultaneous dip logging for MS, HSD, and Power tanks.
   - Verify chart interpolation math and litres manual override.
   - Run compilation and linter.
