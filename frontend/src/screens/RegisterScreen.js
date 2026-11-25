import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Btn, C, ErrorText, Input, LangPicker, RegionPicker, s } from '../ui';

export default function RegisterScreen() {
  const { t, login, region, regionInfo } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '', city: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(await api('/auth/register', { method: 'POST', body: f })); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <LangPicker />
      <RegionPicker />
      <Input icon="person-outline" placeholder={t('name')} value={f.name} onChangeText={set('name')} />
      <Input icon="mail-outline" placeholder={t('email')} value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Input icon="lock-closed-outline" placeholder={`${t('password')} (min. 8)`} value={f.password} onChangeText={set('password')} secureTextEntry />
      <Input icon="location-outline" placeholder={t('city')} value={f.city} onChangeText={set('city')} />
      <ErrorText>{err}</ErrorText>
      <Btn title={t('register')} onPress={submit} disabled={busy || !region || !regionInfo?.up} />
    </ScrollView>
  );
}
