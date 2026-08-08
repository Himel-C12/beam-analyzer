# Deployment

Deploy the project on a Node-capable host such as Render. Keep `STRUCTURECALCS_API_KEY` as a server environment variable. Do not put the secret in frontend JavaScript or a static GitHub Pages deployment.

Build command: `npm install`
Start command: `npm start`
Environment variables: `STRUCTURECALCS_API_KEY`, optionally `PORT`.

The server proxies `/api/beam/solve` to StructureCalcs and never exposes the key to the browser.
