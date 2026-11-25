import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';
import { api, imgUrl } from '../api';
import { Avatar, Btn, C, CAT, Card, ErrorText, Input, Label, Meta, Status, Text, s } from '../ui';
import { fmtDate, money } from '../i18n';

export default function JobDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { t, user } = useApp();
  const [job, setJob] = useState(null);
  const [bid, setBid] = useState({ amount: '', estimated_date: '', message: '' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const j = await api(`/jobs/${id}`);
      setJob(j);
      if (j.my_bid) setBid({ amount: String(Number(j.my_bid.amount)), estimated_date: j.my_bid.estimated_date, message: j.my_bid.message });
    } catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = (fn) => async () => { setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const openChat = async (workerId) => {
    try {
      const c = await api(`/jobs/${id}/conversation`, { method: 'POST', body: workerId ? { worker_id: workerId } : {} });
      navigation.navigate('Chat', { id: c.id, title: job.title });
    } catch (e) { setErr(e.message); }
  };

  if (!job) return <View style={{ padding: 20, flex: 1, backgroundColor: C.bg }}><ErrorText>{err}</ErrorText></View>;
  const isOwner = job.owner_id === user.id;
  const cat = CAT[job.category_slug] || CAT.cleaning;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      {job.images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }}>
          {job.images.map((u) => <Image key={u} source={{ uri: imgUrl(u) }} style={{ width: 280, height: 200, borderRadius: 22, marginRight: 10 }} />)}
        </ScrollView>
      ) : (
        <View style={{ height: 130, borderRadius: 22, backgroundColor: cat.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name={cat.icon} size={56} color={cat.fg} />
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Status value={job.status} />
        <Text style={{ marginLeft: 10, fontWeight: '700', color: cat.fg, fontSize: 13 }}>{t(job.category_slug)}</Text>
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 }}>{job.title}</Text>
      <View style={{ marginTop: 6, marginBottom: 14 }}>
        <Meta icon="location-outline">{job.city}</Meta>
        <Meta icon="calendar-outline">{fmtDate(job.estimated_date)}</Meta>
        <Meta icon="person-outline">{t('by')} {job.owner_name}</Meta>
      </View>

      <View style={{ backgroundColor: C.sunTint, borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <Text style={{ color: '#8A5A00', fontSize: 13, fontWeight: '600' }}>{t('budget')}</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{money(job.budget, job.currency)}</Text>
      </View>
      <Text style={{ lineHeight: 23, marginBottom: 14 }}>{job.description}</Text>
      <ErrorText>{err}</ErrorText>

      {isOwner ? (
        <View>
          <Label>{t('applicants')} ({job.bids.length})</Label>
          {job.bids.map((b) => (
            <Card key={b.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={b.worker_name} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>{b.worker_name}</Text>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(b.estimated_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', fontSize: 17 }}>{money(b.amount, job.currency)}</Text>
                  <Status value={b.status} />
                </View>
              </View>
              {b.message ? <Text style={{ marginTop: 10, lineHeight: 21 }}>{b.message}</Text> : null}
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <Btn kind="ghost" icon="chatbubble-ellipses-outline" title={t('chat')} style={{ flex: 1, marginRight: 8 }} onPress={() => openChat(b.worker_id)} />
                {job.status === 'open' && <Btn icon="checkmark" title={t('accept')} style={{ flex: 1 }} onPress={act(() => api(`/bids/${b.id}/accept`, { method: 'POST' }))} />}
              </View>
            </Card>
          ))}
          {job.status === 'assigned' && <Btn icon="checkmark-circle" title={t('complete')} onPress={act(() => api(`/jobs/${id}/status`, { method: 'PATCH', body: { status: 'completed' } }))} />}
        </View>
      ) : (
        <View>
          <Btn kind="ghost" icon="chatbubble-ellipses-outline" title={t('chat')} onPress={() => openChat()} />
          {job.status === 'open' && (
            <Card style={{ marginTop: 8 }}>
              <Label>{t('offer')} ({job.currency})</Label>
              <Input icon="cash-outline" placeholder={t('amount')} value={bid.amount} onChangeText={(v) => setBid({ ...bid, amount: v })} keyboardType="numeric" />
              <Input icon="calendar-outline" placeholder={t('date')} value={bid.estimated_date} onChangeText={(v) => setBid({ ...bid, estimated_date: v })} />
              <Input placeholder={t('message')} value={bid.message} onChangeText={(v) => setBid({ ...bid, message: v })} multiline />
              {job.my_bid ? <View style={{ marginBottom: 6 }}><Status value={job.my_bid.status} /></View> : null}
              <Btn title={t('apply')} onPress={act(() => api(`/jobs/${id}/bids`, { method: 'POST', body: bid }))} />
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}
