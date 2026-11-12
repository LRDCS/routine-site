# Routine landing page

This folder contains the static public landing page for Routine.

## Google Play link

When Routine has an approved Google Play listing, replace the two temporary
“Coming soon” calls-to-action in `index.html` with the real Play Store URL.

## GitHub Pages deployment

The repository workflow at `.github/workflows/deploy-routine-site.yml` deploys
this folder to GitHub Pages whenever changes are pushed to `main`.

In GitHub, open **Settings → Pages** and set the source to **GitHub Actions**
once. The action will then publish the site at the repository's GitHub Pages
URL.
