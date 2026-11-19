# Menú Escolar · SPA estática

## Propósito

Esta carpeta contiene la versión autónoma de la SPA de menús escolares para GitHub Pages. No depende de ChatGPT Sites, de un backend ni de una fase de compilación: el repositorio se publica tal cual.

## Estructura

- `index.html`: estructura y elementos accesibles de la interfaz.
- `styles.css`: estilos responsive, con prioridad para móvil.
- `app.js`: estado, carga de datos, calendario, selector de tipos, búsqueda y navegación.
- `data/index.json`: catálogo de meses, tipos de menú y fechas disponibles.
- `data/<año>/<mes>.json`: datos mensuales que carga la SPA bajo demanda.
- `parsed/`: JSON de origen locales e ignorados por Git.
- `scripts/generate-menus.mjs`: importación local y generación de los JSON públicos.
- `scripts/menus.mjs` y `scripts/menus.test.mjs`: transformación de datos y pruebas con Node.js.
- `.github/workflows/deploy-pages.yml`: despliegue estático en GitHub Pages.

## Reglas de datos

- Nunca introduzcas menús, fechas o tipos de menú en el código. La fuente de la interfaz es `data/`.
- Al añadir o modificar un mes, actualiza también `data/index.json`.
- Cada entrada mensual necesita como mínimo `date`, `menu_type`, `items` e `is_holiday`.
- Conserva fechas ISO (`YYYY-MM-DD`) y rutas relativas desde la raíz de la SPA.
- Verifica que cada archivo indicado por `data/index.json` existe y contiene JSON válido.

## Importación automática de menús

Cuando el usuario aporte un menú nuevo o corregido para incorporarlo al sitio, ejecuta este flujo desde la raíz del repositorio.

1. Localiza el origen y comprueba el año, el mes y las variantes. Si llega en otro formato, conviértelo al [JSON descrito en el README](README.md#formato-de-origen). Guarda el resultado en `parsed/AAAA/MM/menu-AAAA-MM.json`. Cada JSON sustituye un mes completo. Si faltan datos necesarios para completar el mes, pídelos antes de generarlo.
2. Ejecuta `node scripts/generate-menus.mjs` con Node.js 22 o posterior. El script procesa todos los JSON de `parsed/` y actualiza los archivos mensuales y el índice en `data/`. Aplica solo las correcciones de identificadores confirmadas en `scripts/menu-type-aliases.json`. Si el conversor detecta un error, resuélvelo en el origen si la corrección es verificable y vuelve a ejecutar el comando.
3. Ejecuta la validación mínima de abajo. Revisa `git diff -- data/` y `git status --short -- data/` para comprobar los cambios, incluidos los JSON mensuales nuevos. Comprueba que `git check-ignore parsed/` reconoce la carpeta y que `git ls-files -- parsed/` devuelve una lista vacía.
4. Resume los meses y archivos actualizados. Si la tarea incluye publicar, añade al commit los JSON de `data/`, incluidos los archivos nuevos, haz *push* a `main` y comprueba que GitHub Pages sirve `data/index.json` y los archivos mensuales actualizados.

## Reglas de experiencia

- Mantén la SPA usable en móvil antes que en escritorio.
- Cuando se selecciona un día, el selector de tipo de menú debe mostrar únicamente las variantes disponibles en esa fecha.
- El calendario debe reflejar las variantes disponibles con sus puntos de color.
- Las búsquedas se ejecutan sobre todos los meses y tipos, pero se presentan paginadas.
- No muestres una tarjeta de recomendación de cena si ese dato no existe.
- Conserva etiquetas accesibles, controles por teclado y mensajes claros de ausencia de datos.

## Validación mínima

Ejecuta estos comandos desde la raíz antes de confirmar cambios.

```bash
node --test scripts/menus.test.mjs
node --check app.js
node -e 'const fs=require("fs");const i=JSON.parse(fs.readFileSync("data/index.json","utf8"));for(const m of i.months)JSON.parse(fs.readFileSync(`data/${m.file}`,"utf8"));console.log(`${i.months.length} meses validados`);'
git diff --check
```

## Publicación

- El flujo de GitHub Actions despliega el contenido de la raíz en cada `push` a `main`.
- No añadas `.openai/`, credenciales, dependencias de Sites ni lógica de servidor.
- Mantén los cambios de interfaz y los cambios de datos en commits claros y separados cuando sea práctico.
