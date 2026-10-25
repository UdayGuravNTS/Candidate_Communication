# Candidate Communication (React + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Candidate data

Candidate records are stored in the Django backend's SQLite database. The frontend loads
saved records from the API when the page opens; adding and deleting candidates updates
that database.

## Run locally

1. Start the Django backend from `Hunar_Ai_Backend`:

   ```powershell
   .\venv\Scripts\python.exe manage.py migrate
   .\venv\Scripts\python.exe manage.py runserver
   ```

2. Start the frontend from `Hunar_Ai_Frontend\Candidate_Communication`:

   ```powershell
   npm install
   npm run dev
   ```

Vite proxies `/api` requests to `http://127.0.0.1:8000`. Keep both servers running while
using the application.

Set `VITE_API_URL` to override the API base URL and `VITE_APP_VERSION` to set the version.
Without an override, local development uses the Vite proxy, the configured server IP uses
`http://13.201.107.121:8006/api`, and other deployed hosts use their same-origin `/api`.
The deployed web server must proxy `/api` to Django when using the same-origin option.
When the frontend calls the IP API URL directly from another origin, configure Django's
`CORS_ALLOWED_ORIGINS` setting for the frontend origin. The frontend must also be allowed
by the browser's normal HTTP/HTTPS security rules.

Set Django's `CORS_ALLOWED_ORIGINS` environment variable to a comma-separated list of
exact frontend origins (including scheme and port when non-default). Candidate records
use the backend API; messaging remains unavailable until a real provider endpoint is
configured.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
