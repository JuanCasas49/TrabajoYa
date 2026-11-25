import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Btn, C, ErrorText, Input, LangPicker, RegionPicker, Text } from '../ui';

export default function LoginScreen({ navigation }) {
  const { t, login, region, regionInfo } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(await api('/auth/login', { method: 'POST', body: { email, password } })); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: C.lagoon }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingTop: insets.top + 36, paddingBottom: 64, paddingHorizontal: 24, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -50, top: -30, width: 190, height: 190, borderRadius: 95, backgroundColor: C.sun }} />
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Ionicons name="hammer" size={26} color={C.lagoon} />
          </View>
          <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1.2 }}>TrabajoYa</Text>
          <Text style={{ fontSize: 17, marginTop: 6, maxWidth: 300, lineHeight: 24 }}>{t('tagline')}</Text>
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -32, padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <LangPicker />
          <RegionPicker />
          <Input icon="mail-outline" placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input icon="lock-closed-outline" placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
          <ErrorText>{err}</ErrorText>
          <Btn title={t('login')} onPress={submit} disabled={busy || !region || !regionInfo?.up} />
          <Btn kind="ghost" title={`${t('noAccount')} ${t('register')}`} onPress={() => navigation.navigate('Register')} />
        </View>
      </View>
    </ScrollView>
  );
}
