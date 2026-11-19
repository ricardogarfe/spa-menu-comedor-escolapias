# Menú Escolar · Escolapias

SPA estática e independiente para GitHub Pages.

La web funciona sin Node, sin compilación y sin ChatGPT Sites. GitHub Actions publica los archivos versionados en GitHub Pages.

## Contenido

- `index.html`, `styles.css` y `app.js`: interfaz de la SPA.
- `data/`: índice y menús mensuales ya generados que consume la aplicación.
- `.github/workflows/deploy-pages.yml`: despliegue automático al hacer *push* a `main`.

## Actualizar los menús

1. Guarda cada archivo de origen en `parsed/AAAA/MM/menu-AAAA-MM.json`. Debe contener un array de menús del mes indicado en la ruta.
2. Ejecuta `node scripts/generate-menus.mjs` con Node.js 22 o posterior. El script actualiza los meses que aportes, conserva los demás meses publicados y recalcula `data/index.json`.
3. Ejecuta `node --test scripts/menus.test.mjs`, revisa los cambios en `data/` y súbelos al repositorio. Git ignora `parsed/`, que se guarda localmente.

Cada menú de origen necesita `date` (fecha ISO), `menu_type` (identificador en minúsculas), `items` (array de textos) e `is_holiday` (booleano). El conversor también conserva `menu_id`, `holiday_description` y ambos nombres históricos del campo de cena, `dinner_recommendation` y `recommended_dinner`. Las correcciones de identificadores de origen se mantienen en `scripts/menu-type-aliases.json`.

Las pruebas de validación e importación funcionan en un clon limpio. Si tienes archivos en `parsed/`, la suite también regenera los meses en una carpeta temporal y los compara con `data/`. Con todos los meses de origen, compara también el índice completo.

## Publicar

En el repositorio remoto, activa **Settings → Pages → Build and deployment → GitHub Actions**. Cada *push* posterior a `main` publicará la SPA.

## Licencia

El código y la documentación del proyecto se distribuyen bajo la [licencia MIT](LICENSE). Los contenidos de los menús conservan los derechos de sus titulares.
