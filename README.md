# Beam Analyzer

A browser-based structural beam analyzer by **Md. Hasanuzzaman Himel (RUET CE' 24)**. The interface handles beam properties, supports, loads, unit switching, and engineering diagrams for SFD, BMD, AFD, deflection, and rotation.

## Current features

- Automatic beam analysis through the StructureCalcs API.
- SI and Imperial unit systems with in-place value conversion.
- Pin, roller, and fixed supports.
- **Internal hinges**: add an `Internal Hinge` from the Supports table. The hinge is a UI-level modeling object; before the solve request is sent, the affected span is split at the hinge and the span beginning at that location is sent with `connection: "hinge"`. The hinge itself is not sent as an external support, so it releases bending moment while transferring shear.
- Multiple internal hinges are supported, including hinges inside a span and at existing span boundaries.
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
- Custom logo and favicon using the supplied Himel mark.

## Solver

Beam analysis is performed by the StructureCalcs API. The server keeps the API key private and proxies analysis requests from the browser.

StructureCalcs supports multi-span beams with per-span `E`/`I` and internal hinge connections. Its API defines `connection: "hinge"` as an internal shear hinge that transfers shear and releases moment; the first span must remain `rigid`. urlStructureCalcs API documentationhttps://structurecalcs.com/api

The Beam Analyzer uses a small fetch-boundary adapter (`public/internal-hinge-v2.js`) so the existing solver function sends the transformed, API-compatible model without duplicating the main analysis code.

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
