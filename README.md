# Menú Escolar · Escolapias

SPA estática e independiente para GitHub Pages.

No necesita Node, un proceso de compilación ni ChatGPT Sites. GitHub Actions publica los archivos de este repositorio tal cual en GitHub Pages.

## Contenido

- `index.html`, `styles.css` y `app.js`: interfaz de la SPA.
- `data/`: índice y menús mensuales ya generados que consume la aplicación.
- `.github/workflows/deploy-pages.yml`: despliegue automático al hacer *push* a `main`.

## Actualizar los menús

Reemplaza `data/index.json` y los JSON mensuales correspondientes en `data/<año>/`, valida la SPA localmente y haz *push* a `main`.

## Publicar

En el repositorio remoto, activa **Settings → Pages → Build and deployment → GitHub Actions**. Cada *push* posterior a `main` publicará la SPA.
