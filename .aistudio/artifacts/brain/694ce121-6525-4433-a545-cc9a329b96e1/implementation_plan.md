# Density Register Format Upgrade Plan

Upgrade the **Density Checks** on the Tanks tab to replicate the official statutory Indian Oil / Petroleum Daily Density Register format shown in the user's reference spreadsheet.

---

### User Review Required Before Applying

> [!IMPORTANT]
> The user requested: **"Build Density checks in this format ask me before applying"**.
> Please review the column structure, calculations, and data entry flow below and confirm or request adjustments before implementation.

---

### 1. Proposed Register Layout & Columns (Exact Match to Reference Sheet)

The table will feature a 2-tier header structure identical to the uploaded spreadsheet:

| Tier 1 Header | Tier 2 Sub-Headers | Description & Formulas |
|---|---|---|
| **Date** | *(Single column)* | Date of inspection (e.g. `01/12/2019`) |
| **Morning Density at 15°C U/G Tanks** | **Density** | Observed hydrometer density reading (kg/m³, e.g. `732.0`) |
| | **Temp** | Temperature of fuel sample in °C (e.g. `27.0`) |
| | **Density At 15°C** | Standardized density at 15°C (e.g. `742.7`) calculated via ASTM 53B petroleum conversion formula |
| **Tank/Truck Receipt Density Compartment** | **I** | Compartment 1 density from tanker (kg/m³) |
| | **II** | Compartment 2 density from tanker (kg/m³) |
| | **III** | Compartment 3 density from tanker (kg/m³) |
| | **IV** | Compartment 4 density from tanker (kg/m³) |
| **Mix Compartment** | **Density** | Average of filled tanker compartments: $\text{Average}(I, II, III, IV)$ |
| **Density at 15°C as per chalan** | *(Single column)* | Invoice / Challan density at 15°C from oil company invoice |
| **Dif in Density** | **Mix & Chalan** | Absolute difference: $\|\text{Mix Density} - \text{Challan Density}\|$ (Flagged in red if $> 3.0\text{ kg/m}^3$) |
| **Stock Before Receipt** | **Dip** | Physical dip before decantation (cm) |
| | **Stock** | Stock in tank before decantation (Litres) |
| **Density at 15°C After Decantation and After Dispensing 100 lts** | **Density** | Density at 15°C measured from dispensing nozzle after decanting and flushing 100 L |
| | **Receipt KL** | Quantity received in Kilolitres (e.g. `3.0 KL`, `6.0 KL`, `10.0 KL`) |
| | **Chalaan no** | Tanker invoice / challan number (e.g. `CH-84920`) |

---

### 2. Operational Workflows & Features

1. **Daily Morning Density Recording**:
   - Recorded daily at the start of operations / morning shift for each underground (U/G) tank.
   - Enter **Observed Density** + **Temperature (°C)** &rarr; System automatically computes standard **Density at 15°C**.
   - If no delivery arrives that day, receipt columns remain clean/blank (just like in rows 2, 3, 5, 8, etc. of the sheet).

2. **Delivery / Receipt Recording (Decantation Check)**:
   - When a fuel tanker arrives, the manager/operator records:
     - Compartment readings (I, II, III, IV as applicable).
     - Mix density automatically computes as the mean of filled compartments.
     - Invoice Challan density at 15°C.
     - Difference is automatically calculated: $\text{Mix} - \text{Challan}$.
     - Opening Dip & Stock before unloading.
     - Decantation confirmation: Post-unloading density after 100 L nozzle test.
     - Receipt quantity in KL and Challan Number.

3. **Fuel / Tank Selector**:
   - Multi-tank / Fuel filter (e.g. **Petrol (MS)**, **Diesel (HSD)**, **Power Petrol**) so each fuel product or tank maintains its own statutory register, matching industry standards.
   - Month-wise grouping with export / print view for oil company audits and inspections.

---

### 3. Questions for Confirmation

1. **Organization of the Register**: Would you prefer the Density Register to be organized **per Fuel Product** (e.g. Petrol MS, Diesel HSD) or **per Tank** (e.g. Tank 1, Tank 2)?
2. **Display Location**: Would you like this comprehensive Density Register placed directly on the **Tanks tab** (replacing the existing simple density list) or as a dedicated sub-view?
