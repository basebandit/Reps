import { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';
import { c } from '../theme';

type Row = { user_id: string; display_name: string; total_score: number; sessions: number };
type Mine = { id: string; drill: string; score: number; created_at: string };

const DRILLS = ['Tee work', 'Soft toss', 'Bullpen', 'Sprints'];

export default function HomeScreen({ session }: { session: Session }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [drill, setDrill] = useState('');
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const uid = session.user.id;
  const myRank = rows.findIndex((r) => r.user_id === uid) + 1;
  const myRow = rows.find((r) => r.user_id === uid);
  const name = session.user.user_metadata?.display_name ?? session.user.email?.split('@')[0] ?? 'there';

  const load = useCallback(async () => {
    const [lb, my] = await Promise.all([
      supabase.from('leaderboard').select('*').order('total_score', { ascending: false }).limit(20),
      supabase
        .from('sessions')
        .select('id,drill,score,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    const err = lb.error ?? my.error;
    if (err) { setError(err.message); return; }
    setError('');
    setRows((lb.data ?? []) as Row[]);
    setMine((my.data ?? []) as Mine[]);
  }, [uid]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sessions-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function addSession() {
    const n = Number(score);
    if (!drill.trim()) { setError('Pick or type a drill.'); return; }
    if (!Number.isFinite(n) || n < 0 || score.trim() === '') { setError('Enter a score of 0 or more.'); return; }
    setSaving(true);
    setError('');
    const { error: e } = await supabase.from('sessions').insert({ drill: drill.trim(), score: Math.round(n) });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setDrill('');
    setScore('');
    load();
  }

  function confirmDelete(item: Mine) {
    Alert.alert('Delete session', `Remove ${item.drill} (${item.score})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: e } = await supabase.from('sessions').delete().eq('id', item.id);
          if (e) setError(e.message);
          else load();
        },
      },
    ]);
  }

  const header = (
    <View>
      <View style={s.top}>
        <View>
          <Text style={s.hello}>Hi, {name}</Text>
          <Text style={s.muted}>
            {myRow
              ? `Rank ${myRank} with ${myRow.total_score} points`
              : mine.length ? 'Outside the top 20' : 'Log your first session'}
          </Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10}>
          <Text style={s.link}>Sign out</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Log a session</Text>
        <View style={s.chips}>
          {DRILLS.map((d) => (
            <Pressable key={d} onPress={() => setDrill(d)} style={[s.chip, drill === d && s.chipOn]}>
              <Text style={[s.chipText, drill === d && { color: c.primary }]}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.formRow}>
          <TextInput
            style={[s.input, { flex: 2 }]}
            placeholder="Drill name"
            placeholderTextColor="#9AA6A0"
            value={drill}
            onChangeText={setDrill}
            maxLength={60}
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Score"
            placeholderTextColor="#9AA6A0"
            keyboardType="number-pad"
            value={score}
            onChangeText={setScore}
            maxLength={9}
          />
        </View>
        {!!error && <Text style={s.error}>{error}</Text>}
        <Button title="Log session" onPress={addSession} loading={saving} />
      </View>

      <Text style={s.section}>Leaderboard</Text>
    </View>
  );

  const footer = (
    <View>
      <Text style={s.section}>Your recent sessions</Text>
      {mine.length === 0 ? (
        <Text style={s.muted}>Nothing logged yet.</Text>
      ) : (
        mine.map((m) => (
          <View key={m.id} style={s.mineRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{m.drill}</Text>
              <Text style={s.muted}>{new Date(m.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={s.mineScore}>{m.score}</Text>
            <Pressable onPress={() => confirmDelete(m)} hitSlop={10}>
              <Text style={s.del}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={{ padding: 20 }}
      data={rows}
      keyExtractor={(r) => r.user_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => (
        <View style={[s.row, item.user_id === uid && s.me]}>
          <Text style={s.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.display_name}</Text>
            <Text style={s.muted}>{item.sessions} sessions</Text>
          </View>
          <Text style={s.score}>{item.total_score}</Text>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  hello: { fontSize: 26, fontWeight: '800', color: c.ink },
  muted: { color: c.muted, fontSize: 14 },
  link: { color: c.primary, fontWeight: '700' },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.line },
  cardTitle: { fontSize: 17, fontWeight: '700', color: c.ink, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: c.line },
  chipOn: { backgroundColor: c.ball, borderColor: c.ball },
  chipText: { color: c.muted, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: c.line, borderRadius: 12,
    paddingHorizontal: 12, fontSize: 16, color: c.ink, backgroundColor: c.bg,
  },
  error: { color: c.error, marginBottom: 10 },
  section: { fontSize: 18, fontWeight: '800', color: c.ink, marginTop: 24, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: c.line,
  },
  me: { borderWidth: 2, borderColor: c.primary },
  rank: { width: 26, fontWeight: '900', color: c.primary, fontSize: 18 },
  name: { fontWeight: '700', fontSize: 16, color: c.ink },
  score: { fontWeight: '900', fontSize: 20, color: c.primary },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  mineScore: { fontWeight: '800', fontSize: 16, color: c.ink },
  del: { color: c.error, fontWeight: '600' },
});