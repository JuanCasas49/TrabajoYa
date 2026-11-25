import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../AppContext';
import { GATEWAY, api } from '../api';
import { C, Input, Text } from '../ui';

export default function ChatScreen({ route }) {
  const { id } = route.params;
  const { t, user, region } = useApp();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const list = useRef(null);

  const add = (m) => setMsgs((o) => (o.some((x) => x.id === m.id) ? o : [...o, m]));

  useEffect(() => {
    let socket;
    (async () => {
      setMsgs(await api(`/conversations/${id}/messages`).catch(() => []));
      const token = JSON.parse((await AsyncStorage.getItem('session')) || '{}').token;
      socket = io(GATEWAY, { path: `/${region}/socket.io`, auth: { token }, transports: ['websocket'] });
      socket.on('connect', () => socket.emit('join', id));
      socket.on('message', add);
    })();
    return () => socket?.disconnect();
  }, [id, region]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try { add(await api(`/conversations/${id}/messages`, { method: 'POST', body: { body } })); } catch { setText(body); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender_id === user.id;
          return (
            <View style={{
              alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? C.lagoon : C.surface, maxWidth: '80%', marginBottom: 8,
              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6,
              shadowColor: '#10293B', shadowOpacity: mine ? 0 : 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: mine ? 0 : 1,
            }}>
              <Text style={{ lineHeight: 21 }}>{item.body}</Text>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: C.surface, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <Input style={{ flex: 1, marginBottom: 0, marginRight: 8, borderRadius: 999 }} placeholder={t('writeMsg')} value={text} onChangeText={setText} onSubmitEditing={send} />
        <Pressable onPress={send} accessibilityLabel={t('send')} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.lagoon, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.8 }]}>
          <Ionicons name="send" size={20} color={C.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
