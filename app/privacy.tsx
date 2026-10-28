import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { config } from '../lib/config';
import { colors } from '../lib/theme';

const P = ({ children }: { children: ReactNode }) => <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 10 }}>{children}</Text>;

// Placeholder summary. The binding notice must be drafted and approved by Mexican counsel (LFPDPPP).
export default function Privacy() {
  return (
    <Screen back title="Aviso de privacidad" subtitle={`Versión ${config.privacyNoticeVersion}`}>
      <Notice tone="warning">BORRADOR pendiente de revisión legal. No usar con menores reales hasta su aprobación.</Notice>
      <Glass>
        <P>Datos que tratamos: correo y nombre o alias del adulto; alias, nivel y grado de cada estudiante; respuestas del cuestionario inicial (sin edad exacta); planes, sesiones, resultados de simulacros; materiales que subes y el texto extraído de ellos; métricas de uso del tutor (sin guardar el texto de las conversaciones).</P>
        <P>Finalidades: crear tu plan de estudio, operar el tutor, calificar simulacros y mostrar reportes familiares. No vendemos datos ni mostramos publicidad.</P>
        <P>Proveedores: base de datos y almacenamiento (Supabase) y proveedor de IA configurado. Las transferencias internacionales deben detallarse en el aviso definitivo.</P>
        <P>Derechos ARCO: desde Perfil puedes descargar tus datos y eliminar tu cuenta. {config.supportEmail ? `Contacto: ${config.supportEmail}.` : 'El canal de contacto se publicará antes del lanzamiento.'}</P>
      </Glass>
    </Screen>
  );
}
