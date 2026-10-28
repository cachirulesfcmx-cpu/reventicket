# Claude Code — implementación, estabilización y despliegue de VANTA EDGE

Copia el siguiente prompt en Claude Code desde la raíz del repositorio. Dale acceso solo a los repositorios y cuentas que sean necesarios; usa variables de entorno y nunca pegues secretos en el chat o en archivos versionados.

---

Actúa como un equipo senior compuesto por arquitecto de software, ingeniero full-stack, ingeniero ML/MLOps, especialista en Supabase/PostgreSQL, DevOps y QA. Trabaja sobre el repositorio VANTA EDGE abierto en el directorio actual. Tu objetivo es llevar el proyecto desde su estado real hasta un MVP desplegado y verificable, sin afirmar que una tarea está completa si no hay evidencia ejecutable.

## Producto y alcance
VANTA EDGE es una plataforma de análisis deportivo informativo para iPhone, Android y web, con seis categorías: Liga MX, UEFA Champions League, LaLiga, NFL, MLB y NBA. La experiencia visual es oscura, premium y Liquid Glass-inspired. Incluye calendario, fichas de partido, datos, análisis, probabilidades explicables, historial auditable y rendimiento de modelos. No debe aceptar apuestas, custodiar dinero ni integrar transacciones de juego.

## Reglas innegociables
1. Inspecciona primero todo el repositorio, git status, scripts, dependencias, pruebas, migraciones y documentación. No sobrescribas trabajo preexistente sin entenderlo.
2. Produce un plan corto y luego ejecuta el trabajo de principio a fin. No te detengas tras dar recomendaciones.
3. No inventes resultados deportivos, cuotas, lesiones, alineaciones, históricos, secretos, URL de servicios ni estados de despliegue. Los datos de demo deben estar etiquetados como demo.
4. Mantén `PREDICTIONS_ENABLED=false` hasta que exista proveedor de datos real, modelos validados y evidencia de backtesting. Si los modelos no superan los criterios, deja los picks reales desactivados y explica el bloqueo.
5. No afirmes “todo funciona perfecto”. Informa resultados exactos de pruebas y cualquier limitación pendiente.
6. Nunca imprimas secretos. Nunca añadas `.env`, service role keys, tokens, claves de proveedores o credenciales a Git, logs, capturas o reportes. Usa los gestores de secretos de GitHub/Vercel y variables locales no versionadas.
7. No ejecutes acciones destructivas en producción sin revisar el impacto y obtener autorización explícita. No uses `db reset`, no borres datos, no hagas force-push y no desactives protecciones de rama.
8. Las escrituras de Supabase desde el cliente deben quedar protegidas por RLS. La service-role key solo puede vivir en entorno server-side. Audita todas las políticas y pruebas de acceso anónimo/autenticado.
9. Los proveedores de datos deben tener licencia y cobertura comercial adecuadas. Antes de contratar, verificar los seis deportes, endpoints, históricos, cuotas, rate limits, atribución, almacenamiento, logos/fotos y redistribución.
10. Usa commits pequeños y descriptivos. No hagas merge ni despliegue a producción si el usuario no lo ha autorizado de forma explícita. Puedes preparar una rama y un preview de Vercel si los permisos lo permiten.

## Etapa A — auditoría inicial
- Inspecciona el monorepo y comprueba que los comandos del README coinciden con package.json.
- Detecta errores, dependencias incompatibles, scripts obsoletos, imports rotos y diferencias entre el alcance y lo implementado.
- Crea `docs/IMPLEMENTATION_STATUS.md` con estado por área: completo, parcial, bloqueado; evidencia y siguiente acción.
- No declares funcional una integración que use datos demo.

## Etapa B — implementar y estabilizar el código
- Asegura que el dashboard Next.js compile, responda correctamente y se vea bien en móvil y escritorio.
- Asegura que Expo compile para iOS y Android. Si es posible, ejecuta typecheck y Expo Doctor; resuelve errores reales sin actualizar paquetes indiscriminadamente.
- Revisa accesibilidad, contraste, estados de carga/error/vacío, fechas y zonas horarias, manejo de fallos de red y diseño adaptable.
- Completa navegación a detalle de partido, filtros por deporte, picks, seguimiento/favoritos y rendimiento, sin mostrar información ficticia como real.
- Añade tests unitarios e integración para las rutas API, validación de datos, permisos, errores y cálculos de probabilidad.
- Añade validación de esquemas en todos los límites de entrada; sanitiza datos de proveedores y controla rate limits.
- El LLM solo explica datos recuperados; no puede inventar estadísticas ni generar probabilidades por texto.
- Corrige scripts de lint/typecheck para las versiones instaladas. Mantén lockfile consistente.

## Etapa C — Supabase
- Si hay credenciales y autorización disponibles, vincula el proyecto existente usando Supabase CLI. No crees otro proyecto si ya existe uno sin verificarlo.
- Aplica las migraciones en una base de staging primero. Revisa el SQL y las políticas RLS antes de ejecutar.
- Ejecuta `supabase db lint` o equivalente disponible, verifica índices, constraints, triggers y relaciones. Si el CLI requiere login o proyecto no configurado, indica exactamente el paso manual y continúa con pruebas locales.
- Comprueba con pruebas que usuarios anónimos no pueden escribir datos canónicos, odds, modelos o predicciones; que usuarios solo pueden ver/modificar sus perfiles, preferencias y equipos seguidos; y que los picks públicos solo exponen registros publicados permitidos.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` a browser, Expo, `NEXT_PUBLIC_*` ni bundles. Añade un chequeo automatizado para detectar patrones de secretos y un `.env.example` sin valores reales.
- Añade generación de tipos TypeScript de Supabase si el proyecto está enlazado y guarda los tipos generados.

## Etapa D — datos deportivos
- Define una interfaz común `SportsDataProvider` y adaptadores aislados por proveedor.
- Implementa un adaptador demo claramente marcado y al menos una integración real solo si hay clave y cobertura confirmada. No finjas que existe un feed real si falta la credencial.
- Antes de activar proveedor, verifica con pruebas una muestra real por cada deporte y competencia: calendario, resultados, equipos, identificadores, timestamps, estados, histórico, lesiones/alineaciones y cuotas cuando el producto las necesite.
- Registra fuente, hora de captura, freshness, calidad y licencias. Implementa reintentos con backoff, límites, idempotencia, caché, observabilidad y alertas de datos obsoletos.
- Si falta cobertura en cualquier deporte, muestra “datos no disponibles” para esa función y deja constancia; no rellenes con información inventada.

## Etapa E — motor predictivo y validación
- Construye módulos independientes por deporte. Usa baselines apropiados antes de modelos complejos: modelos de goles/Elo para fútbol; eficiencia y puntos para NFL; carreras, abridor y bullpen para MLB; posesiones, eficiencia y minutos para NBA.
- Toda feature debe ser reconstruible con la información disponible a la hora de la predicción. Evita data leakage, usar alineaciones posteriores al inicio o ajustar con el holdout.
- Implementa backtesting cronológico walk-forward, splits por tiempo, calibración, Brier Score, log loss, métricas por mercado y comparaciones con baselines. Si hay cuotas, guarda timestamp y método de eliminación del margen.
- Mide incertidumbre, cobertura, datos faltantes, intervalos de confianza y múltiples comparaciones. Mantén un holdout bloqueado y registro de experimentos.
- Crea un gate de promoción: ningún modelo pasa a producción sin un informe reproducible y aprobación explícita. Si no hay evidencia, los resultados son experimentales y no se publican como picks recomendados.
- No declares una ventaja rentable por un ROI histórico aislado. Incluye costes, límites, cuotas realmente disponibles, tamaño de muestra y variabilidad.

## Etapa F — GitHub
- Comprueba branch protection, workflows, lockfile, tests, typecheck, build, seguridad de dependencias y escaneo de secretos.
- Haz los cambios en una rama `feat/vanta-edge-stabilization` o una rama equivalente no protegida.
- Asegura CI en pull requests. Añade checks para web, móvil, predictor, SQL/RLS y seguridad cuando sean ejecutables.
- No hagas push si no tienes autorización y no fusiones automáticamente a main.

## Etapa G — Vercel y despliegue
- Verifica si el proyecto Vercel ya existe y si está conectado al repositorio. No crees duplicados sin confirmar.
- Configura Root Directory como `apps/web` si se despliega el dashboard desde ese paquete; respeta la estrategia de workspaces y fija correctamente Install Command, Build Command y Output Settings.
- Configura variables de entorno por entorno (Preview/Production) usando la UI/CLI segura. Nunca imprimas sus valores. La app web debe funcionar en modo demo sin secretos y las rutas de health deben ser públicas y no filtrar configuración.
- Despliega primero Preview. Ejecuta smoke tests en URL real: HTTP 200, `/api/health`, `/api/games`, `/api/picks`, errores, responsive y logs. Verifica que no se filtran stack traces ni secretos.
- Producción solo tras autorización explícita y checklist completo. Si falta autorización, deja Preview listo y entrega instrucciones para promoverlo.
- Para Expo/EAS, prepara configuración y builds de prueba si las credenciales están disponibles. No afirmes que está en App Store/Google Play sin completar las revisiones y publicaciones reales.

## Etapa H — entrega y evidencia
Al terminar, crea:
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/DATA_PROVIDER_MATRIX.md`
- `docs/MODEL_VALIDATION.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SMOKE_TEST_RESULTS.md`
- `.env.example` actualizado sin secretos
- `docs/ROLLBACK.md`

Incluye comandos ejecutados, códigos de salida, resumen de tests, URL de Preview solo si la CLI la devolvió realmente, commit SHA, migraciones aplicadas, variables que faltan por nombre (nunca su valor), cobertura real de datos por deporte y bloqueos restantes. Distingue con claridad entre verificado localmente, verificado en Preview y no verificado.

## Criterio de aceptación
- Web build y typecheck pasan.
- Expo doctor/typecheck pasan o sus limitaciones están documentadas.
- Tests de API y predictor pasan.
- Migraciones y RLS están auditadas y verificadas en staging.
- Ningún secreto en Git ni en bundles cliente.
- Modo demo claramente rotulado.
- No hay picks reales publicados sin modelos y datos validados.
- Preview smoke tests pasan.
- Documentación de despliegue, rollback y estado está completa.

Empieza auditando el repositorio y ejecuta el trabajo. No te limites a describir lo que harías. Cuando una credencial, autorización o servicio externo sea indispensable y no esté disponible, completa todo lo que sí pueda hacerse, registra el bloqueo con precisión y pide únicamente el dato/acción que falta.
