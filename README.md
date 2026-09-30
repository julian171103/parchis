# Parchís

Parchís local para 2, 3 o 4 jugadores en el mismo computador. Sitio web estático, sin backend.

## Tecnologías
HTML5, CSS3 y JavaScript vanilla.

## Estructura
```
parchis/
├── index.html
├── style.css
├── game.js
├── assets/   (opcional: tablero.png, dado.png, ficha-roja.png, ficha-verde.png, ficha-azul.png, ficha-amarilla.png)
└── README.md
```

## Ejecutar localmente
Abre `index.html` en el navegador, o sirve la carpeta:
```
npx serve .      # o: python -m http.server
```

## Reemplazar los assets
Copia los PNG en `assets/` con los nombres exactos. Si un archivo no existe, el juego dibuja esa pieza con CSS. No hay que tocar la lógica.
- `tablero.png`: cuadrado, solo visual. Las casillas reales están en `PATH` (game.js), en una rejilla de 19×19.
- `ficha-*.png`: fondo transparente, aprox. 128×128.
- `dado.png`: fondo de la cara del dado; los puntos se dibujan encima.

Nota: el navegador puede mostrar un aviso 404 en consola por cada PNG ausente; es normal y no afecta al juego.

## Reglas
Sacar ficha con 5 · captura fuera de casillas seguras (★) · 64 casillas + camino final · meta con número exacto · gana quien lleve las 4 fichas a la meta.

## Desplegar en Vercel
1. Sube la carpeta a un repositorio de GitHub.
2. En vercel.com: **Add New → Project** e importa el repositorio.
3. Framework Preset: **Other**, sin comando de build ni directorio de salida. Pulsa **Deploy**.