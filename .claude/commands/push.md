---
description: Commitea los cambios de la sesión actual y pushea a main. Solo stagea archivos modificados en esta sesión, no cambios pre-existentes.
allowed-tools: [Bash]
---

# Push — Commitear y pushear

## Pasos

### 1. Entender el estado actual

Corré en paralelo:
- `git status --short`
- `git diff HEAD`
- `git log --oneline -5`

### 2. Identificar qué commitear

Solo stagear archivos que fueron modificados **en esta sesión de trabajo**.
- Si hay archivos con cambios pre-existentes (que ya aparecían modificados al inicio de la conversación), **no los incluyas** a menos que el usuario lo pida explícitamente.
- Si no hay nada nuevo que commitear, informá al usuario y no hagas nada.

### 3. Crear el commit

Seguí el estilo del proyecto:
- Formato: `tipo: descripción en inglés, imperativo, minúsculas`
- Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `chore`
- Mensaje que explique **qué** se hizo y **por qué** si no es obvio
- **No agregar Co-Authored-By ni atribuciones de AI**

Ejemplo:
```
git commit -m "feat: add inline cell editing to inventory table"
```

### 4. Push

```
git push origin main
```

### 5. Confirmar

Reportá en una línea: hash del commit + "pusheado a main".
