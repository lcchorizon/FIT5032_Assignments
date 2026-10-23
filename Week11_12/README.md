# Week 11 and 12 eFolio

I used the form from my earlier library project and added a deployment version of Get Weather. This folder is a separate hosting lab. It does not include the Firebase account and book pages from Week 9 and 10.

## Run locally

```sh
npm ci
npm run dev
npm run build
```

## Weather

I use HTTPS for both the Open-Meteo city search and weather request. This version does not need an API key in the browser or the build server. Type a city and click Get Weather. An empty city, an unknown city and a failed request show an error. Data is loaded when the user submits the form.

## Cloudflare Pages from Git

Use this repository, with `Week11_12` as the root directory, `npm run build` as the build command, and `dist` as the output directory. The Cloudflare base path is `/`.

## Cloudflare Pages from the CLI

I created the Vue Pages starter with C3 using `--framework=vue --platform=pages`. I then used my library app build for the CLI deployment. The generated starter is kept locally in `tmp/hl-library-c3`.

```sh
npm create cloudflare@latest -- hl-library-c3 --framework=vue --platform=pages
npx wrangler login --scopes account:read user:read pages:write
npx wrangler pages project create hl-library-c3 --production-branch main --force
npm run deploy
```

The installed Wrangler version needs `--force` when creating a legacy Pages project. Normal deployments then use `wrangler pages deploy`. I keep this CLI project configuration in `wrangler.c3.jsonc` so it does not replace the separate Git deployment settings. The project has no paid resources.

## GitHub Pages

The workflow in `.github/workflows/week11-12-pages.yml` installs dependencies, builds this folder and publishes the result through GitHub Pages. `DEPLOY_BASE` is set to `/FIT5032_Assignments/`. The router uses Vite's base path. The workflow makes a `404.html` copy for history routes on GitHub Pages. Open the home link first and use Get Weather in the navigation.

## Research

TTFB and hotlink answers and source links are in the evidence PDF. These answers describe possible improvements. They do not claim performance measurements or protection settings that I have not tested.

## Deployed links

- Cloudflare from Git: https://hl-library-git.pages.dev/
- Cloudflare from C3 / CLI: https://hl-library-c3.pages.dev/
- GitHub Pages: https://lcchorizon.github.io/FIT5032_Assignments/
- First successful workflow: https://github.com/lcchorizon/FIT5032_Assignments/actions/runs/39921411051

The evidence PDF includes real browser screenshots. The GitHub Pages server returned HTTP 200 when checked against its public DNS address. The local DNS resolver initially failed for that new hostname.
