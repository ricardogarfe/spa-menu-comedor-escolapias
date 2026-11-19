# Menú Escolar · Escolapias

SPA estática e independiente para GitHub Pages.

La web funciona sin Node, sin compilación. GitHub Actions publica los archivos versionados en GitHub Pages.

## Contenido

- `index.html`, `styles.css` y `app.js`: interfaz de la SPA.
- `data/`: índice y menús mensuales ya generados que consume la aplicación.
- `parsed/`: JSON de origen guardados en local e ignorados por Git.
- `scripts/`: conversor y pruebas para actualizar los datos publicados.
- `.github/workflows/deploy-pages.yml`: despliegue automático al hacer *push* a `main`.

## Actualizar los menús

1. **Prepara el origen.** Guarda un JSON por mes en `parsed/AAAA/MM/menu-AAAA-MM.json`. Cada archivo debe contener un array con todas las entradas y variantes disponibles para ese mes. Para corregir un mes ya publicado, actualiza su JSON de origen completo.
2. **Genera los datos públicos.** Desde la raíz del repositorio, ejecuta `node scripts/generate-menus.mjs` con Node.js 22 o posterior. El conversor reemplaza los meses aportados, conserva el resto del histórico y recalcula `data/index.json`.
3. **Verifica el resultado.** Ejecuta `node --test scripts/menus.test.mjs` y revisa `git diff -- data/` y `git status --short -- data/`. La segunda orden también muestra los archivos mensuales nuevos.
4. **Publica la actualización.** Incluye en el commit el índice y los JSON mensuales nuevos o modificados en `data/`. Un *push* a `main` activa el despliegue de GitHub Pages.

### Formato de origen

Cada entrada necesita `date` (fecha ISO `AAAA-MM-DD`), `menu_type` (identificador en minúsculas), `items` (array de textos) e `is_holiday` (booleano). Los campos opcionales son `menu_id`, `holiday_description`, `dinner_recommendation` y `recommended_dinner`. El conversor lee JSON mensuales. Los datos que lleguen en otro formato deben prepararse como JSON antes de la importación.

Las pruebas de validación e importación funcionan en un clon limpio. Si tienes archivos en `parsed/`, la suite también regenera los meses en una carpeta temporal y los compara con `data/`. Con todos los meses de origen, compara también el índice completo.

## Configuración inicial de GitHub Pages

En el repositorio remoto, selecciona **GitHub Actions** en **Settings → Pages → Build and deployment**.

## Licencia

El código y la documentación del proyecto se distribuyen bajo la [licencia MIT](LICENSE). Los contenidos de los menús conservan los derechos de sus titulares.
