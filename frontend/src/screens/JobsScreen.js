import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useApp } from '../AppContext';
import { api, imgUrl } from '../api';
import { C, CAT, Card, CatTile, Chip, Chips, Input, Meta, Text, s } from '../ui';
import { fmtDate, money } from '../i18n';

export default function JobsScreen({ navigation }) {
  const { t, categories, regionInfo } = useApp();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [cat, setCat] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (city) p.set('city', city);
      if (cat) p.set('category', cat);
      setItems(await api(`/jobs?${p}`));
    } catch { /* se mantiene la lista actual */ } finally { setLoading(false); }
  }, [q, city, cat]);

  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const header = (
    <View style={{ marginBottom: 4 }}>
      {regionInfo ? <Text style={{ color: C.muted, marginBottom: 12 }}>{regionInfo.flag} {regionInfo.name} · {regionInfo.currency}</Text> : null}
      <Input icon="search" placeholder={t('search')} value={q} onChangeText={setQ} />
      <Input icon="location-outline" placeholder={t('city')} value={city} onChangeText={setCity} />
      <Chips>
        <Chip label={t('all')} active={!cat} onPress={() => setCat('')} />
        {categories.map((c) => <Chip key={c} icon={CAT[c]?.icon} label={t(c)} active={cat === c} onPress={() => setCat(c)} />)}
      </Chips>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={s.screen}
      data={items}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={{ color: C.muted, textAlign: 'center', marginTop: 36 }}>{t('empty')}</Text>}
      refreshing={loading}
      onRefresh={load}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('JobDetail', { id: item.id })} style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.cover
              ? <Image source={{ uri: imgUrl(item.cover) }} style={{ width: 84, height: 84, borderRadius: 16 }} />
              : <CatTile slug={item.category_slug} size={84} radius={16} />}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: CAT[item.category_slug]?.fg }}>{t(item.category_slug)}</Text>
              <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '700', marginTop: 1 }}>{item.title}</Text>
              <Meta icon="location-outline">{item.city}</Meta>
              <Meta icon="calendar-outline">{fmtDate(item.estimated_date)}</Meta>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '800' }}>{money(item.budget, item.currency)}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{item.bids_count} {t('bids')}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}
