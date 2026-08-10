# Deployment

Beam Analyzer is now a static browser application and is deployed with **GitHub Pages**.

## Production deployment

- Source frontend: `public/`
- Deployment workflow: `.github/workflows/pages.yml`
- Hosting: GitHub Pages
- Solver: local deterministic Euler-Bernoulli direct-stiffness solver in the browser

Every push to `main` publishes the `public/` frontend through GitHub Actions.

## Local development

The browser application can be served as static files from `public/`. The Node server in `server/` is retained for local/server compatibility, but production beam analysis no longer depends on it.

No `STRUCTURECALCS_API_KEY` is required by the production frontend.

## GitHub Pages settings

In the repository settings, open **Pages** and set **Build and deployment → Source** to **GitHub Actions**.
