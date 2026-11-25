import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Avatar, Btn, C, Card, CatTile, Label, LangPicker, Status, Text, s } from '../ui';
import { fmtDate, money } from '../i18n';

export default function MyJobsScreen({ navigation }) {
  const { t, logout, user, regionInfo } = useApp();
  const [data, setData] = useState({ posted: [], applied: [] });
  const load = useCallback(async () => { try { setData(await api('/jobs/mine')); } catch { /* sin conexión */ } }, []);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const row = (j, status, price, extra) => (
    <Pressable key={j.id} onPress={() => navigation.navigate('JobDetail', { id: j.id })} style={({ pressed }) => pressed && { opacity: 0.9 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <CatTile slug={j.category_slug} size={52} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 16 }}>{j.title}</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{j.city}, {fmtDate(j.estimated_date)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Status value={status} />
            <Text style={{ marginLeft: 8, color: C.muted, fontSize: 12 }}>{extra}</Text>
          </View>
        </View>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>{price}</Text>
      </Card>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Avatar name={user.name} size={60} bg={C.sun} fg={C.ink} />
        <View style={{ marginLeft: 14 }}>
          <Text style={{ fontWeight: '800', fontSize: 20 }}>{user.name}</Text>
          {regionInfo ? <Text style={{ color: C.muted, marginTop: 2 }}>{regionInfo.flag} {regionInfo.name} · {regionInfo.currency}</Text> : null}
        </View>
      </View>
      <LangPicker />
      <Label>{t('posted')}</Label>
      {data.posted.length ? data.posted.map((j) => row(j, j.status, money(j.budget, j.currency), `${j.bids_count} ${t('bids')}`)) : <Text style={{ color: C.muted, marginBottom: 12 }}>{t('empty')}</Text>}
      <Label>{t('applied')}</Label>
      {data.applied.length ? data.applied.map((j) => row(j, j.bid_status, money(j.bid_amount, j.currency), '')) : <Text style={{ color: C.muted, marginBottom: 12 }}>{t('empty')}</Text>}
      <Btn kind="ghost" icon="log-out-outline" title={t('logout')} onPress={logout} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}
