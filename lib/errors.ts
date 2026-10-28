// Turns API / database errors into short Spanish messages. Raw provider or SQL text is
// never shown to students.
const BY_CODE: Record<string, string> = {
  STUDIA_ADULT_ATTESTATION_REQUIRED: 'La cuenta debe crearla una persona adulta.',
  STUDIA_PRIVACY_NOTICE_REQUIRED: 'Debes aceptar el aviso de privacidad.',
  STUDIA_GUARDIAN_CONSENT_REQUIRED: 'Se necesita la autorización del padre, madre o tutor.',
  STUDIA_ADULT_ACCOUNT_REQUIRED: 'Solo una cuenta de adulto puede crear perfiles de estudiantes.',
  STUDIA_STUDENT_LIMIT: 'Alcanzaste el máximo de perfiles de estudiante.',
  STUDIA_MINOR_REQUIRES_GUARDIAN_PROFILE: 'Para menores de edad, primero crea su perfil desde el espacio familiar.',
  STUDIA_UNSUPPORTED_TYPE: 'Formato no permitido. Usa PDF, JPG, PNG, WEBP o TXT.',
  STUDIA_FILE_TOO_LARGE: 'El archivo supera 10 MB.',
  STUDIA_MATERIAL_LIMIT: 'Alcanzaste el límite de materiales guardados.',
  STUDIA_RATE_LIMITED: 'Has subido muchos archivos hoy. Intenta mañana.',
  STUDIA_UPLOAD_MISSING: 'La subida no se completó. Intenta de nuevo.',
  STUDIA_NO_QUESTIONS: 'Aún no hay preguntas para esta materia.',
  STUDIA_ALREADY_SUBMITTED: 'Este simulacro ya fue calificado.',
  STUDIA_PLAN_ALREADY_GENERATED: 'Este plan ya tiene sesiones.',
  STUDIA_NOT_FOUND: 'No encontramos ese elemento.',
  quota_exceeded: 'Llegaste al límite diario del tutor. Vuelve mañana.',
  budget_exhausted: 'El tutor no está disponible por ahora. Intenta más tarde.',
  tutor_timeout: 'El tutor tardó demasiado. Intenta de nuevo.',
  tutor_unavailable: 'El tutor no está disponible por ahora.',
  tutor_not_configured: 'El tutor todavía no está configurado en este entorno.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
};

export function friendlyError(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  const raw =
    typeof err === 'string' ? err
      : err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message)
        : '';
  for (const [code, msg] of Object.entries(BY_CODE)) if (raw.includes(code)) return msg;
  if (/network|fetch|Failed to fetch|timeout/i.test(raw)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return fallback;
}
