import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput as RNInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from './AppContext';
import { LANGS } from './i18n';

// ---------- Diseño: aqua "lagoon" + tinta azul marino + toque sol ----------
export const C = {
  bg: '#F3F9FA', surface: '#FFFFFF', ink: '#10293B', muted: '#5B7685', line: '#DCEBEE',
  lagoon: '#27D3C6', tint: '#DDF8F5', deep: '#0B7F85', sun: '#FFC94D', sunTint: '#FFF3D1',
  danger: '#D64550', ok: '#2BB673',
};
export const R = { card: 20, field: 14, pill: 999 };

// ---------- Tipografía: Plus Jakarta Sans (si no carga, usa la fuente del sistema) ----------
let fontsOK = false;
export const setFontsOK = (v) => { fontsOK = v; };
const FAM = { 500: 'PlusJakartaSans_500Medium', 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold', 800: 'PlusJakartaSans_800ExtraBold' };
const famOf = (w) => { const n = w === 'bold' ? 700 : Number(w) || 500; return n >= 800 ? FAM[800] : n >= 700 ? FAM[700] : n >= 600 ? FAM[600] : FAM[500]; };
// Estilo de fuente por peso, para usarlo también en cabeceras de navegación
export const fam = (w) => (fontsOK ? { fontFamily: famOf(w), fontWeight: 'normal' } : { fontWeight: String(w) });

export function Text({ style, ...p }) {
  const f = StyleSheet.flatten(style) || {};
  return <RNText {...p} style={[{ color: C.ink, fontSize: 15 }, style, fontsOK ? { fontFamily: famOf(f.fontWeight), fontWeight: 'normal' } : null]} />;
}

// ---------- Componentes ----------
export const Btn = ({ title, onPress, kind, disabled, style, icon }) => {
  const ghost = kind === 'ghost';
  const color = ghost ? C.deep : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, disabled && { opacity: 0.45 }, style]}>
      {icon ? <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} /> : null}
      <Text style={{ fontWeight: '700', fontSize: 15, color }}>{title}</Text>
    </Pressable>
  );
};

export function Input({ style, icon, onFocus, onBlur, ...p }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[s.field, focus && s.fieldFocus, p.multiline && { alignItems: 'flex-start' }, style]}>
      {icon ? <Ionicons name={icon} size={18} color={focus ? C.deep : C.muted} style={{ marginRight: 10, marginTop: p.multiline ? 13 : 0 }} /> : null}
      <RNInput placeholderTextColor="#8FA5B1" {...p}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        style={[s.input, fontsOK && { fontFamily: FAM[500] }, p.multiline && { height: 96, textAlignVertical: 'top' }, Platform.select({ web: { outlineStyle: 'none' } })]} />
    </View>
  );
}

export const Chip = ({ label, active, onPress, icon, dot, sub }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.chip, active && s.chipOn, pressed && { opacity: 0.8 }]}>
    {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginRight: 7 }} /> : null}
    {icon ? <Ionicons name={icon} size={15} color={active ? C.ink : C.muted} style={{ marginRight: 6 }} /> : null}
    <Text style={{ fontWeight: '600', fontSize: 14, color: active ? C.ink : C.muted }}>{label}</Text>
    {sub ? <Text style={{ fontSize: 12, color: active ? C.ink : '#8FA5B1', marginLeft: 6 }}>{sub}</Text> : null}
  </Pressable>
);
export const Chips = ({ children }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ paddingRight: 8 }}>{children}</ScrollView>
);

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const Label = ({ children }) => <Text style={{ fontWeight: '700', fontSize: 17, marginTop: 8, marginBottom: 10 }}>{children}</Text>;
export const ErrorText = ({ children }) => (children ? <Text style={{ color: C.danger, marginVertical: 8, fontWeight: '600' }}>{children}</Text> : null);

export const Meta = ({ icon, children }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
    <Ionicons name={icon} size={14} color={C.muted} style={{ marginRight: 5 }} />
    <Text numberOfLines={1} style={{ color: C.muted, fontSize: 13, flexShrink: 1 }}>{children}</Text>
  </View>
);

const STATUS = {
  open: ['#DDF8F5', '#0B6B70'], assigned: ['#DCEBFF', '#1E4F9A'], completed: ['#E2F6D9', '#2F6B1F'], cancelled: ['#FFE3E3', '#A33A3A'],
  pending: ['#FFF1CC', '#8A5A00'], accepted: ['#E2F6D9', '#2F6B1F'], rejected: ['#FFE3E3', '#A33A3A'],
};
export function Status({ value }) {
  const { t } = useApp();
  const [bg, fg] = STATUS[value] || STATUS.open;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{t(value)}</Text>
    </View>
  );
}

// Cada categoría tiene su icono y color
export const CAT = {
  plumbing: { icon: 'water', bg: '#DCEBFF', fg: '#1E6FD9' },
  construction: { icon: 'construct', bg: '#FFE9C7', fg: '#B86E00' },
  electricity: { icon: 'flash', bg: '#FFF3C2', fg: '#A87F00' },
  painting: { icon: 'color-palette', bg: '#FFE0E6', fg: '#D6396B' },
  cleaning: { icon: 'sparkles', bg: '#DDF8F5', fg: '#0B8A85' },
  gardening: { icon: 'leaf', bg: '#E2F6D9', fg: '#3C8A1F' },
};
export function CatTile({ slug, size = 56, radius }) {
  const c = CAT[slug] || CAT.cleaning;
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.3, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={c.icon} size={size * 0.5} color={c.fg} />
    </View>
  );
}

export const Avatar = ({ name = '?', size = 40, bg = C.tint, fg = C.deep }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontWeight: '800', fontSize: size * 0.42, color: fg }}>{name.trim().charAt(0).toUpperCase()}</Text>
  </View>
);

export function LangPicker() {
  const { lang, setLang } = useApp();
  return <Chips>{LANGS.map((l) => <Chip key={l} label={l.toUpperCase()} active={l === lang} onPress={() => setLang(l)} />)}</Chips>;
}

// Selector de país: punto verde = región disponible, rojo = caída
export function RegionPicker() {
  const { regions, region, selectRegion, t } = useApp();
  const list = regions.filter((r) => r.configured);
  const current = list.find((r) => r.code === region);
  return (
    <View>
      <Label>{t('pickCountry')}</Label>
      <Chips>
        {list.map((r) => (
          <Chip key={r.code} active={r.code === region} onPress={() => selectRegion(r.code)}
            dot={r.up ? C.ok : C.danger} label={`${r.flag} ${r.name}`} sub={r.currency} />
        ))}
      </Chips>
      {current && !current.up ? <ErrorText>{t('regionDown')}</ErrorText> : null}
    </View>
  );
}

const shadow = { shadowColor: '#10293B', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 };
export const s = StyleSheet.create({
  btn: { backgroundColor: C.lagoon, minHeight: 50, paddingHorizontal: 20, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginVertical: 6 },
  btnGhost: { backgroundColor: C.tint },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: R.field, paddingHorizontal: 14, marginBottom: 10 },
  fieldFocus: { borderColor: C.lagoon },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.ink },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
  chipOn: { backgroundColor: C.lagoon, borderColor: C.lagoon },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 14, marginBottom: 12, ...shadow },
  screen: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
