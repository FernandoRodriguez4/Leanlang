                                                                                                                  # Leanlang Frontend

Frontend de Leanlang construido con Next.js, React 18, TypeScript y Tailwind CSS.

## Requisitos Previos

- **Node.js** 18+ ([Descargar](https://nodejs.org/))
- **npm** 9+ (incluido con Node.js) o **yarn** / **pnpm**

Verifica tu versión:
```bash
node --version
npm --version
```

## Instalación

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd frontend
```

### 2. Instalar dependencias
```bash
npm install
```

O si usas yarn/pnpm:
```bash
yarn install
# o
pnpm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y completa las variables:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus valores:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Nota:** 
- `NEXT_PUBLIC_API_URL`: URL del servidor backend (por defecto apunta a `http://localhost:8000`)
- Las variables que comienzan con `NEXT_PUBLIC_` son expuestas al cliente

## Ejecución

### Servidor de Desarrollo
Inicia el servidor en modo desarrollo con hot-reload:

```bash
npm run dev
```

El servidor estará disponible en: **http://localhost:3000**

### Build para Producción
Compila la aplicación para producción:

```bash
npm run build
```

### Ejecutar en Producción
Después de hacer build, ejecuta:

```bash
npm start
```

## Scripts Disponibles

- **`npm run dev`** - Inicia servidor de desarrollo
- **`npm run build`** - Compila para producción
- **`npm start`** - Ejecuta la compilación de producción
- **`npm run lint`** - Ejecuta el linter (ESLint)

## Stack Tecnológico

- **Framework:** Next.js 14.2.35
- **UI Library:** React 18.3.1
- **Language:** TypeScript 5.5.3
- **Styling:** Tailwind CSS 3.4.6
- **Build Tool:** SWC (integrado en Next.js)

## Estructura del Proyecto

```
frontend/
├── app/              # Directorio de rutas (App Router)
├── components/       # Componentes reutilizables
├── public/          # Archivos estáticos
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Solución de Problemas

### Puerto 3000 ya está en uso
```bash
npm run dev -- -p 3001  # Usa el puerto 3001
```

### Error: "Cannot find module"
Asegúrate de haber ejecutado `npm install`:
```bash
npm install
```

### El backend no responde
Verifica que:
1. El backend está corriendo en el puerto 8000
2. La variable `NEXT_PUBLIC_API_URL` en `.env.local` apunta a la URL correcta

## Desarrollo

### Crear un nuevo componente
Los componentes se crean en la carpeta `components/`.

### Agregar nuevas rutas
En Next.js con App Router, crea carpetas en `app/` con un archivo `page.tsx`.

### Styled con Tailwind CSS
Usa clases de Tailwind directamente en los componentes:
```tsx
<div className="flex gap-4 p-6">
  <h1 className="text-2xl font-bold">Hola Mundo</h1>
</div>
```

## Más Información

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
