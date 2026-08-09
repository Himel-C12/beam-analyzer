# Beam Analyzer

A browser-based structural beam analyzer by **Md. Hasanuzzaman Himel (RUET CE' 24)**. The interface handles beam properties, supports, loads, unit switching, and engineering diagrams for SFD, BMD, AFD, deflection, and rotation.

## Current features

- Automatic beam analysis through the StructureCalcs API.
- SI and Imperial unit systems with in-place value conversion.
- Pin, roller, and fixed supports.
- **Internal hinges**: add an `Internal Hinge` from the Supports table. The UI maps the hinge location to the solver's span `connection: "hinge"`, which releases bending moment while transferring shear.
- Point loads, angular point loads, UDLs/linearly varying distributed loads, and applied moments.
- Point-load angle input defaults to `0°`; non-zero angles use the vertical component for the current beam solver.
- Clear engineering-style beam visualization with vertical load arrows and distinct support symbols.
- CW/CCW labels for applied moments and support-reaction moments.
- SFD, BMD, AFD, deflection, and rotation diagrams with important-point values and jump annotations.
- Optional diagram value annotations for a cleaner presentation.
- Automatic label fitting for unusually large numerical values so chart labels remain visible.
- Light and dark themes.
- Save/load model JSON and copyable share links.
- Printable calculation report.
- Custom logo and favicon using the BeamLab mark.

## Solver

Beam analysis is performed by the StructureCalcs API. The server keeps the API key private and proxies analysis requests from the browser.

The API supports multi-span beams with internal hinges through span connections. See the [StructureCalcs API documentation](https://structurecalcs.com/api) for the underlying solver and request format.

## Run locally

1. Copy `.env.example` to `.env`.
2. Put your private StructureCalcs key in `STRUCTURECALCS_API_KEY`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Never commit `.env` or expose the API key in frontend code.

## Project structure

- `public/` — production frontend served by the Node server.
- `frontend/` — frontend source mirror.
- `backend/` and `server/` — API proxy/server implementations.
- `render.yaml` — Render deployment configuration.

## Deployment

The project is deployed as a Node web service on Render. The production frontend is served from `public/`.

## Credits

Beam Analyzer is a student-built engineering tool by **Md. Hasanuzzaman Himel**, RUET Civil Engineering.
