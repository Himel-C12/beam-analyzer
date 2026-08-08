# Beam Analyzer v7

A responsive browser-based beam analysis interface using the StructureCalcs API as the solver.

## v7
- Larger, clearer typography and touch targets.
- Mobile-first responsive layout.
- Automatic debounced analysis; there is no Calculate button.
- Units remain in the top-right toolbar and values convert when the unit system changes.
- Engineering-style beam editor with draggable supports and loads.
- SFD, BMD, AFD, deflection and rotation diagrams with feature markers and hover values.
- Cleaner interface with non-essential helper text removed.
- Safer local-model loading and drag undo/redo handling.
- Server paths resolve relative to the project, so `npm start` works from the project root reliably.
- API key stays server-side.

## Run locally
1. Copy `.env.example` to `.env`.
2. Put your private StructureCalcs key in `STRUCTURECALCS_API_KEY`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Never commit `.env`.

by Md. Hasanuzzaman Himel (RUET CE' 24)
