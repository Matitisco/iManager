# Diseño

Serializar las mutaciones de equipo mediante SELECT de Store FOR UPDATE en una transacción ReadCommitted. Releer actor, objetivo y conteo de propietarios después del lock. Coordinar aceptación con el mismo lock, conservando el orden usuario → invitación → billing → tienda. Reintentar de forma acotada conflictos de serialización/deadlock; ejecutar auditoría dentro de la transacción y analytics después del commit.

Regresiones concurrentes con Promise.all y PostgreSQL local exclusivo; barreras sobre lecturas inseguras fuera de transacción para reproducir el fallo original de forma determinista. Conservar la clave única existente (storeId, userId). Activar tienda requiere membresía activa verificada dentro de transacción.
