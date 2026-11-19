# Menú Escolar · SPA estática

## Propósito

Esta carpeta contiene la versión autónoma de la SPA de menús escolares para GitHub Pages. No depende de ChatGPT Sites, de un backend ni de una fase de compilación: el repositorio se publica tal cual.

## Estructura

- `index.html`: estructura y elementos accesibles de la interfaz.
- `styles.css`: estilos responsive, con prioridad para móvil.
- `app.js`: estado, carga de datos, calendario, selector de tipos, búsqueda y navegación.
- `data/index.json`: catálogo de meses, tipos de menú y fechas disponibles.
- `data/<año>/<mes>.json`: datos mensuales que carga la SPA bajo demanda.
- `.github/workflows/deploy-pages.yml`: despliegue estático en GitHub Pages.

## Reglas de datos

- Nunca introduzcas menús, fechas o tipos de menú en el código. La fuente de la interfaz es `data/`.
- Al añadir o modificar un mes, actualiza también `data/index.json`.
- Cada entrada mensual necesita como mínimo `date`, `menu_type`, `items` e `is_holiday`.
- Conserva fechas ISO (`YYYY-MM-DD`) y rutas relativas desde la raíz de la SPA.
- Verifica que cada archivo indicado por `data/index.json` existe y contiene JSON válido.

## Reglas de experiencia

- Mantén la SPA usable en móvil antes que en escritorio.
- Cuando se selecciona un día, el selector de tipo de menú debe mostrar únicamente las variantes disponibles en esa fecha.
- El calendario debe reflejar las variantes disponibles con sus puntos de color.
- Las búsquedas se ejecutan sobre todos los meses y tipos, pero se presentan paginadas.
- No muestres una tarjeta de recomendación de cena si ese dato no existe.
- Conserva etiquetas accesibles, controles por teclado y mensajes claros de ausencia de datos.

## Validación mínima

Antes de confirmar cambios, ejecuta desde la raíz:

```bash
node --check app.js
node -e 'const fs=require("fs");const i=JSON.parse(fs.readFileSync("data/index.json","utf8"));for(const m of i.months)JSON.parse(fs.readFileSync(`data/${m.file}`,"utf8"));console.log(`${i.months.length} meses validados`);'
git diff --check
```

## Publicación

- El flujo de GitHub Actions despliega el contenido de la raíz en cada `push` a `main`.
- No añadas `.openai/`, credenciales, dependencias de Sites ni lógica de servidor.
- Mantén los cambios de interfaz y los cambios de datos en commits claros y separados cuando sea práctico.
