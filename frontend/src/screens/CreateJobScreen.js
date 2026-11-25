import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Btn, C, CAT, Chip, Chips, ErrorText, Input, Label, Text, s } from '../ui';

export default function CreateJobScreen({ navigation }) {
  const { t, categories, user, regionInfo } = useApp();
  const empty = { category_slug: '', title: '', description: '', city: user?.city || '', budget: '', estimated_date: '' };
  const [f, setF] = useState(empty);
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }));

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (!r.canceled) setPhotos(r.assets.slice(0, 5));
  };

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      for (const [i, a] of photos.entries()) {
        if (Platform.OS === 'web') fd.append('images', await (await fetch(a.uri)).blob(), `foto${i}.jpg`);
        else fd.append('images', { uri: a.uri, name: `foto${i}.jpg`, type: a.mimeType || 'image/jpeg' });
      }
      const job = await api('/jobs', { method: 'POST', form: fd });
      setF({ ...empty }); setPhotos([]);
      navigation.navigate('JobDetail', { id: job.id });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <Label>{t('category')}</Label>
      <Chips>{categories.map((c) => <Chip key={c} icon={CAT[c]?.icon} label={t(c)} active={f.category_slug === c} onPress={() => set('category_slug')(c)} />)}</Chips>
      <Input placeholder={t('title')} value={f.title} onChangeText={set('title')} />
      <Input placeholder={t('description')} value={f.description} onChangeText={set('description')} multiline />
      <Input icon="location-outline" placeholder={t('city')} value={f.city} onChangeText={set('city')} />
      <Input icon="cash-outline" placeholder={`${t('budget')} (${regionInfo?.currency || ''})`} value={f.budget} onChangeText={set('budget')} keyboardType="numeric" />
      <Input icon="calendar-outline" placeholder={t('date')} value={f.estimated_date} onChangeText={set('estimated_date')} />
      <Pressable onPress={pick} style={({ pressed }) => [{ borderWidth: 2, borderStyle: 'dashed', borderColor: C.lagoon, backgroundColor: C.tint, borderRadius: 18, padding: 18, alignItems: 'center', marginTop: 4 }, pressed && { opacity: 0.8 }]}>
        <Ionicons name="images-outline" size={26} color={C.deep} />
        <Text style={{ color: C.deep, fontWeight: '700', marginTop: 6 }}>{t('photos')} ({photos.length}/5)</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {photos.map((a, i) => <Image key={i} source={{ uri: a.uri }} style={{ width: 72, height: 72, borderRadius: 14, marginRight: 8, marginBottom: 8 }} />)}
      </View>
      <ErrorText>{err}</ErrorText>
      <Btn title={t('submit')} onPress={submit} disabled={busy || !f.category_slug} />
    </ScrollView>
  );
}
