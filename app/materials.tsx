import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Empty, ErrorState, Loading, Notice } from '../components/States';
import { deleteMaterial, listMaterials, materialUrl, uploadMaterial, type Material } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { useFocusData } from '../lib/useAsync';
import { formatBytes, titleFromFileName, validateUpload } from '../lib/uploads';
import { colors, radii } from '../lib/theme';

const STATUS: Record<string, { label: string; color: string }> = {
  pending_upload: { label: 'Subiendo…', color: colors.muted },
  uploaded: { label: 'En cola para leer', color: colors.lilac },
  processing: { label: 'Leyendo contenido…', color: colors.lilac },
  ready: { label: 'Listo para el tutor', color: colors.mint },
  failed: { label: 'No se pudo leer', color: colors.danger },
};

const UPLOAD_ERRORS = {
  unsupported_type: 'Formato no permitido. Usa PDF, JPG, PNG, WEBP o TXT.',
  too_large: 'El archivo supera 10 MB.',
  empty: 'El archivo está vacío.',
};

type Picked = { uri: string; name: string; size?: number | null; mimeType?: string | null; file?: Blob };

export default function Materials() {
  const { data, error, loading, reload } = useFocusData(listMaterials);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handle(file: Picked) {
    const check = validateUpload(file);
    if (!check.ok) { setMsg({ tone: 'error', text: UPLOAD_ERRORS[check.error] }); return; }
    setBusy(true); setMsg(null);
    try {
      await uploadMaterial({ uri: file.uri, title: titleFromFileName(file.name), mimeType: check.mimeType, size: file.size!, blob: file.file });
      setMsg({ tone: 'success', text: 'Material subido. Lo leeremos en unos minutos.' });
      reload();
    } catch (e) { setMsg({ tone: 'error', text: friendlyError(e, 'No se pudo subir el archivo.') }); } finally { setBusy(false); }
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain'], copyToCacheDirectory: true, multiple: false });
    if (!res.canceled && res.assets[0]) handle(res.assets[0] as Picked);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setMsg({ tone: 'error', text: 'Necesitamos permiso de cámara para fotografiar tus apuntes.' }); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = res.assets?.[0];
    if (!res.canceled && a) handle({ uri: a.uri, name: a.fileName ?? 'foto.jpg', size: a.fileSize, mimeType: a.mimeType ?? 'image/jpeg', file: a.file });
  }

  async function view(m: Material) {
    try { await WebBrowser.openBrowserAsync(await materialUrl(m.storage_path)); } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); }
  }

  async function remove(m: Material) {
    if (pendingDelete !== m.id) { setPendingDelete(m.id); return; }
    try { await deleteMaterial(m); setPendingDelete(null); reload(); } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); }
  }

  return (
    <Screen back title="Mis materiales" subtitle="PDF, fotos o texto (máx. 10 MB). Se guardan en almacenamiento privado; solo tú puedes verlos.">
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Button label="Subir archivo" onPress={pickDocument} loading={busy} style={{ flex: 1 }} />
        <Button label="Tomar foto" variant="secondary" onPress={takePhoto} disabled={busy} style={{ flex: 1 }} />
      </View>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <Empty title="Sin materiales" body="Sube tus apuntes para que el tutor los use como contexto." />
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          {data.map((m) => {
            const st = STATUS[m.status] ?? STATUS.failed;
            return (
              <View key={m.id} style={styles.card}>
                <Pressable style={{ flex: 1 }} onPress={() => view(m)} accessibilityRole="button" accessibilityLabel={`Abrir ${m.title}`}>
                  <Text style={styles.title} numberOfLines={1}>{m.title}</Text>
                  <Text style={styles.muted}>{m.mime_type.split('/')[1].toUpperCase()} · {formatBytes(m.size_bytes)}</Text>
                  <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>
                </Pressable>
                <Pressable onPress={() => remove(m)} style={styles.del} accessibilityRole="button"
                  accessibilityLabel={pendingDelete === m.id ? `Confirmar eliminar ${m.title}` : `Eliminar ${m.title}`}>
                  <Text style={{ color: colors.danger, fontSize: 14 }}>{pendingDelete === m.id ? '¿Eliminar?' : 'Eliminar'}</Text>
                </Pressable>
              </View>
            );
          })}
          <Button label="Actualizar estados" variant="ghost" onPress={reload} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, marginTop: 4 },
  status: { fontSize: 13, marginTop: 4 },
  del: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center' },
});
