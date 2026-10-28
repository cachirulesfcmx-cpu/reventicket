# Dirección visual: StudIA Liquid Glass

## Referencia

Las capturas aportadas (Astra AI) se usaron solo como referencia de estructura e interacción: onboarding secuencial, fondo negro espacial, títulos grandes centrados, barra de progreso, tarjetas de cristal con borde fino, iconografía a la derecha y CTA persistente. No se reutilizan marcas, textos promocionales, cifras de usuarios ni recursos gráficos de terceros. La pantalla de precios de referencia **no** se replicó: los pagos están fuera de alcance hasta decidir canal y políticas de tiendas.

## Tokens (`lib/theme.ts`)

- Fondo `#08090D` con gradiente nocturno y estrellas sutiles.
- Texto `#F7F7FB` (≥7:1) y secundario `#A3A4B2` (≥4.5:1) — verificado en `lib/validation.test.ts`.
- Acento índigo `#5B5DF5` / lavanda `#B8A7FF`; CTA en gradiente índigo con texto blanco (≥4.5:1).
- Superficies blancas al 4.5–9 % con borde al 14 %; `expo-blur` solo decorativo en iOS.

## Flujo implementado (`app/onboarding.tsx` + `lib/onboarding.ts`)

1. Rol (estudiante, padre/madre/tutor, docente, otro).
2. Voz del tutor con muestra real vía TTS del dispositivo (`expo-speech`) o modo solo texto.
3. Edad (stepper accesible + atajos). Menores deben confirmar que un adulto crea la cuenta.
4. Necesidad principal.
5. Crear preparación (unirse: “Próximamente”, deshabilitado).
6. Fecha del examen calculada dinámicamente + calendario de 60 días.
7. Materia con búsqueda sin acentos/mayúsculas y “Agrega tu materia”.
8. Meta (60/80/95 % como objetivos, no como progreso).
9. Principal preocupación.
10. Disponibilidad de apuntes → registro.

Las respuestas se guardan como borrador local y se reanudan en el primer paso incompleto. Tras crear la cuenta de adulto, se envían a `save_onboarding` (lista blanca de valores, banda de edad). El servidor rechaza respuestas de menores que no estén ligadas a un perfil de estudiante con consentimiento vigente.

## Accesibilidad verificada (E2E)

- Roles/nombres accesibles en todos los controles; estado `aria-checked`/`aria-disabled`, barra de progreso con `aria-valuenow`.
- Navegación por teclado (Tab + Enter) en web.
- 320 px de ancho con texto al 200 % sin scroll horizontal.
- Selección indicada por borde, relleno y ✓ (no solo color). Sin animaciones (respeta reducción de movimiento).

## Pendiente

- Verificación en dispositivos físicos iOS/Android (áreas seguras, barra de navegación Android, lectores VoiceOver/TalkBack).
- Pruebas de rendimiento en gama baja.
- Revisión legal del flujo de consentimiento.
