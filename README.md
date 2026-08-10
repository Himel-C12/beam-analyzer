# Beam Analyzer by Himel

A browser-based beam analysis tool for calculating and visualizing **Shear Force Diagram (SFD), Bending Moment Diagram (BMD), Axial Force Diagram (AFD), deflection, and rotation/slope**.

**Live app:** https://himel-c12.github.io/beam-analyzer/

## What it can analyze

- Pin, roller, and fixed supports
- Internal hinges
- Single or multiple spans
- Point loads
- Point loads at an angle
- UDLs and linearly varying distributed loads
- Applied moments
- Support settlement
- SI and Imperial units

## How to use it

### 1. Define the beam

Under **Beam properties**, enter the length of each span.

For each span, enter:

- **Length** — beam length
- **E (GPa)** — Young's modulus
- **I (mm⁴)** — second moment of area

Use **+ Span** if the beam has multiple spans.

### 2. Add supports

Under **Supports**, add the required supports and enter their positions along the beam.

Available support types:

- **Pin**
- **Roller**
- **Fixed**
- **Internal Hinge**

For supports that allow settlement, enter the settlement value in **mm**.

### 3. Add loads

Under **Loads**, use the appropriate button:

- **Point** — concentrated force at a position
- **UDL / varying** — distributed load between `From` and `To`
- **Moment** — applied concentrated moment at a position

For a varying distributed load, enter the load intensity at both ends using **Value** and **Value 2 (UDL)**.

Use the sign convention shown by the input values. For vertical loads, a negative value represents a downward load.

### 4. Check the analysis

The tool solves the model automatically after the inputs are changed.

The **Results** section shows:

- Maximum shear force
- Maximum bending moment
- Maximum deflection
- Maximum axial force
- Support reactions

### 5. Read the diagrams

The **Diagrams** section provides:

- **SFD** — Shear Force Diagram
- **BMD** — Bending Moment Diagram
- **AFD** — Axial Force Diagram
- **Deflection Diagram**
- **Rotation / Slope**

Important points, extrema, and genuine discontinuities are marked on the diagrams.

**Rotation / slope is displayed in radians (rad).** It is an angular quantity, not a force, so it should not be labelled in kN or kip.

### 6. Evaluate a point

Use **Point of interest** to enter any beam position `x` and evaluate the corresponding analysis results at that location.

### 7. Save, load, or share a model

- **Save** stores the current model as JSON.
- **Load** restores a previously saved JSON model.
- **Share** creates a link containing the model data.
- **Print calculation report** generates a printable report.

## Units

The toolbar provides two unit systems:

- **SI:** m, kN, kN/m, kN·m, mm, GPa, mm⁴
- **Imperial:** ft, kip, kip/ft, kip·ft, in

Rotation/slope is displayed in **radians** in either unit system.

Point-load **angle input is in degrees (°)**.

## Tips

- Keep all support and load positions within the total beam length.
- For a point load or moment, enter its position in **Position / From**.
- For a distributed load, make sure `To` is greater than `From`.
- Use the built-in examples to quickly test common beam configurations.

## Author

**Md. Hasanuzzaman Himel**  
RUET Civil Engineering
