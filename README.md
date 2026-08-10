# Beam Analyzer

A browser-based structural beam analyzer by **Md. Hasanuzzaman Himel (RUET CE' 24)**. The interface handles beam properties, supports, loads, unit switching, and engineering diagrams for SFD, BMD, AFD, deflection, and rotation.

## Current features

- Local browser-based beam analysis with a deterministic Euler-Bernoulli direct-stiffness solver.
- SI and Imperial unit systems with in-place value conversion.
- Pin, roller, and fixed supports.
- Internal hinges with released rotations.
- Multiple spans and internal hinges.
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

Beam analysis is performed locally in the browser. The solver uses an Euler-Bernoulli beam stiffness formulation with released rotations at internal hinges and a Gaussian elimination solve for the structural system.

Normal beam analysis and internal-hinge analysis therefore do not require the StructureCalcs API or a server-side API key.

## Run locally

The production frontend is the `public/` directory and can be served by any static HTTP server.

The repository also retains the Node server for development/server compatibility:

1. Run `npm install`.
2. Run `npm start`.
3. Open `http://localhost:3000`.

No StructureCalcs API key is required for the current local solver path.

## Project structure

- `public/` — production static frontend.
- `frontend/` — older frontend source mirror retained for reference.
- `server/` — Node server retained for local/server compatibility.
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow.
- `render.yaml` — legacy Render configuration retained but no longer required for production hosting.

## Deployment

The production site is deployed to GitHub Pages. GitHub Actions publishes `public/` on every push to `main`. GitHub Pages is a static hosting service, which fits the current browser-only solver architecture. citeturn0search2turn0search1

## Credits

Beam Analyzer is a student-built engineering tool by **Md. Hasanuzzaman Himel**, RUET Civil Engineering.
