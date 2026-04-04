---
name: imanager-design
description: Sistema de diseño de iManager — colores, tipografía, componentes, animaciones y patrones visuales. Leer antes de escribir cualquier JSX nuevo.
---

# iManager Design System

Aplicar esta skill antes de escribir cualquier JSX nuevo o modificar componentes visuales.

Todo el estilo es **Tailwind CSS 4 + motion/react**. No hay design tokens propios — los patrones están en el código. Esta skill los centraliza.

---

## Paleta de colores

### Superficies

| Uso | Clase |
|-----|-------|
| Fondo de app | `bg-gray-50` |
| Cards, sidebar, header | `bg-white` |
| Input background | `bg-gray-50` |
| Hover en listas/filas | `hover:bg-gray-50` |
| Sección sutil dentro de card | `bg-gray-50/50` |

### Bordes

| Uso | Clase |
|-----|-------|
| Divisores principales | `border-gray-200` |
| Divisores internos (dentro de cards) | `border-gray-100` |

### Texto

| Jerarquía | Clase |
|-----------|-------|
| Primario (títulos, datos) | `text-gray-900` |
| Secundario (labels, subtítulos) | `text-gray-600` |
| Muted (metadatos, fechas) | `text-gray-500` |
| Placeholder / íconos | `text-gray-400` |

### Acción principal

```
bg-black text-white   →   hover: bg-gray-800 (o bg-zinc-800)
```

El negro es el único color de acción. No usar azules ni violetas para CTAs.

### Colores semánticos

| Estado | Background | Borde | Texto |
|--------|-----------|-------|-------|
| Error | `bg-red-50` | `border-red-200` | `text-red-700` |
| Alerta crítica | `bg-red-50` | `border-red-100` | `text-red-900` |
| Warning | `bg-amber-50` | `border-amber-100` | `text-amber-900` |
| Éxito / OK | `bg-emerald-50` | `border-emerald-100` | `text-emerald-800` |

### Pantalla de login (única excepción oscura)

El panel izquierdo del login usa `bg-zinc-950` con orbs de blur. No replicar este patrón en el core de la app.

---

## Tipografía

**Fuente:** Inter (Google Fonts, cargada en `index.css`)

| Caso | Clases |
|------|--------|
| Título de card / sección | `text-lg font-bold text-gray-900` |
| Título de página / modal | `text-xl font-bold` o `text-3xl font-bold tracking-tight` |
| Body / tabla | `text-sm` |
| Label de formulario | `text-xs font-bold text-gray-700` |
| Badge / chip | `text-xs font-bold uppercase tracking-wide` |
| Metadata / fecha | `text-xs text-gray-400` |
| Descripción secundaria | `text-sm text-gray-500` |

---

## Border radius

| Elemento | Clase |
|---------|-------|
| Cards, modales, dropdowns | `rounded-2xl` |
| Botones, inputs, nav items | `rounded-xl` |
| Badges de estado pequeños | `rounded-md` |
| Avatares, dots | `rounded-full` |
| Error inline en form (pequeño) | `rounded-lg` |

---

## Sombras

| Elemento | Clase |
|---------|-------|
| Modales | `shadow-2xl` |
| Dropdowns | `shadow-xl` |
| Botón CTA | `shadow-sm` |

---

## Componentes

### Botón primario (CTA)

```tsx
<motion.button
  whileHover={{ scale: 1.02, y: -1 }}
  whileTap={{ scale: 0.98 }}
  className="bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
>
  <Plus size={18} />
  Etiqueta
</motion.button>
```

### Botón secundario (outline)

```tsx
<motion.button
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.98 }}
  className="border border-gray-200 bg-white text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
>
  Etiqueta
</motion.button>
```

### Botón destructivo

```tsx
<button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
  <Trash size={16} />
  Eliminar
</button>
```

### Input de formulario

```tsx
// Label + input siempre en un div con space-y-1
<div className="space-y-1">
  <label className="text-xs font-bold text-gray-700">Campo</label>
  <input
    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
  />
</div>
```

Input grande (ej. login):
```tsx
className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
```

### Select

Mismas clases que el input. Agregar `appearance-none` si se customiza la flecha.

### Card / panel de contenido

```tsx
<div className="bg-white p-6 rounded-2xl border border-gray-200">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-lg font-bold text-gray-900">Título</h2>
    {/* acción opcional */}
  </div>
  {/* contenido */}
</div>
```

### Badge de estado

```tsx
<span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md uppercase tracking-wide">
  DISPONIBLE
</span>
```

Con color semántico:
```tsx
<span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md uppercase tracking-wide">
  ACTIVO
</span>
```

### Error inline en formulario

```tsx
{error && (
  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    {error}
  </div>
)}
```

### Tabla

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-left text-sm">
    <thead>
      <tr className="text-gray-500 border-b border-gray-100">
        <th className="pb-4 font-semibold">Columna</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="py-4 font-medium text-gray-900">Dato</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modal

El componente `Modal` en `src/components/Modal.tsx` ya maneja el patrón completo. Usarlo directamente:

```tsx
<Modal isOpen={isOpen} onClose={onClose} title="Título">
  {/* contenido */}
</Modal>
```

Si necesitás un modal custom (tamaño diferente, etc.):
- Backdrop: `bg-black/40 backdrop-blur-sm`
- Contenedor: `bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`
- Header: `px-6 py-4 border-b border-gray-100`
- Body: `p-6 overflow-y-auto`

### Dropdown

```tsx
<motion.div
  initial={{ opacity: 0, y: 10, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: 10, scale: 0.95 }}
  transition={{ duration: 0.2 }}
  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
>
  {/* items */}
</motion.div>
```

---

## Animaciones

**Librería:** `motion/react` (no `framer-motion`)

```tsx
import { motion, AnimatePresence } from 'motion/react';
```

### Reglas generales

- Todo render condicional va dentro de `<AnimatePresence>`
- Los botones interactivos usan `whileHover` + `whileTap`
- Las entradas de página/sección usan `opacity + y`
- Los modales y panels usan spring

### Valores estándar

```ts
// Entrada de sección/página
initial={{ opacity: 0, y: 15 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -15 }}
transition={{ duration: 0.3, ease: "easeOut" }}

// Modal
initial={{ opacity: 0, scale: 0.95, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95, y: 20 }}
transition={{ type: "spring", damping: 25, stiffness: 300 }}

// Dropdown
initial={{ opacity: 0, y: 10, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 10, scale: 0.95 }}
transition={{ duration: 0.2 }}

// Sidebar mobile
initial={{ x: '-100%' }}
animate={{ x: 0 }}
exit={{ x: '-100%' }}
transition={{ type: 'spring', damping: 25, stiffness: 200 }}

// Lista con stagger
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};
```

### whileHover / whileTap por tipo de elemento

| Elemento | whileHover | whileTap |
|---------|-----------|---------|
| Botón CTA | `{ scale: 1.02, y: -1 }` | `{ scale: 0.98 }` |
| Botón outline / menú | `{ scale: 1.01 }` | `{ scale: 0.98 }` |
| Ícono button (bell, close) | `{ scale: 1.1, rotate: 10 }` | `{ scale: 0.9 }` |
| Nav item sidebar | `{ x: 4 }` | `{ scale: 0.98 }` |
| Card interactiva | `{ scale: 1.02 }` | — |
| Logo icon | `{ rotate: 90 }` spring | — |
| Close icon (X) en modal | `{ scale: 1.1, rotate: 90 }` | `{ scale: 0.9 }` |

---

## Layout

### Shell general

```tsx
<div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
  <Sidebar />
  <div className="flex-1 flex flex-col overflow-hidden">
    <Header />
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* contenido de página */}
    </main>
  </div>
</div>
```

### Grid de cards KPI

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### Grid de contenido

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="col-span-1 lg:col-span-2"> {/* contenido principal */} </div>
  <div> {/* sidebar derecho */} </div>
</div>
```

### Espaciado entre secciones

`space-y-6` entre secciones de página.

---

## Loading states

Spinner estándar (inline en botón):

```tsx
<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
```

Spinner en superficie clara:

```tsx
<div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
```

---

## Scrollbar oculto

En contenedores con overflow que no deben mostrar scrollbar:

```tsx
className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
```

---

## Lo que NO hacer

- No usar colores de acción que no sean negro (`bg-blue-*`, `bg-violet-*`, etc.) para CTAs
- No usar `framer-motion` — solo `motion/react`
- No usar `rounded-full` en botones o inputs — es para avatares y dots
- No usar sombras grandes (`shadow-2xl`) en botones — solo en modales
- No agregar animaciones de hover en elementos no interactivos
- No variar el tamaño base de texto (`text-sm` es el estándar del core)
- No usar `font-sans` en elementos individuales — ya está en el shell global
