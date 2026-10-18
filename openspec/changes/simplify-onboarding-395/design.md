# Diseño

Reutilizar StockOnboarding y todos sus flujos. OnboardingJourney renderiza Stock para cualquier etapa incompleta previa (incluidas invite/video). Nuevas tiendas guardan stock como etapa inicial; lecturas normalizan etapas antiguas sin migraciones ni reabrir recorridos completos.

El backend calcula stock con filas sin sampleBatchId; el fallback frontend usa únicamente stock real. Nombre sigue derivado del nombre persistido. ExchangeProvider muestra la cotización real en la fila plegable de moneda.

Preservar el DashboardContent y la isla flotante de #386. CSS con selectores de Dashboard, panel y onboarding exclusivamente; márgenes 16/32, gaps 8/16, secciones 24 y ancho de contenido 1120. Capturas antes de editar y después a 390×844 y 1440×900, PostgreSQL local imanager_test y puertos 4395/3395.
