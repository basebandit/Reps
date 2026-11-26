import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  Pressable, SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Row = { user_id: string; display_name: string; total_score: number; sessions: number };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;
  return (
    <SafeAreaView style={styles.screen}>
      {session ? <Home session={session} /> : <Auth />}
    </SafeAreaView>
  );
}

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(mode: 'in' | 'up') {
    setBusy(true);
    const { error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) Alert.alert(mode === 'in' ? 'Sign in failed' : 'Sign up failed', error.message);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.pad}>
      <Text style={styles.title}>Reps</Text>
      <Text style={styles.sub}>Log your drills. Climb the board.</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword} />
      <Pressable style={styles.btn} disabled={busy} onPress={() => run('in')}>
        <Text style={styles.btnText}>Sign in</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnAlt]} disabled={busy} onPress={() => run('up')}>
        <Text style={[styles.btnText, { color: '#1f3a5f' }]}>Create account</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function Home({ session }: { session: Session }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [drill, setDrill] = useState('');
  const [score, setScore] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard').select('*').order('total_score', { ascending: false }).limit(20);
    if (error) Alert.alert('Could not load leaderboard', error.message);
    else setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sessions-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function addSession() {
    const n = Number(score);
    if (!drill.trim() || !Number.isFinite(n) || n < 0) {
      Alert.alert('Check your entry', 'Enter a drill name and a score of 0 or more.');
      return;
    }
    const { error } = await supabase.from('sessions').insert({ drill: drill.trim(), score: Math.round(n) });
    if (error) Alert.alert('Could not save session', error.message);
    else { setDrill(''); setScore(''); }
  }

  return (
    <View style={styles.pad}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Drill (e.g. tee work)"
          value={drill} onChangeText={setDrill} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Score" keyboardType="number-pad"
          value={score} onChangeText={setScore} />
      </View>
      <Pressable style={styles.btn} onPress={addSession}>
        <Text style={styles.btnText}>Log session</Text>
      </Pressable>

      <FlatList
        style={{ marginTop: 16 }}
        data={rows}
        keyExtractor={(r) => r.user_id}
        ListEmptyComponent={<Text style={styles.sub}>No sessions yet. Log the first one.</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.user_id === session.user.id && styles.me]}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.sub}>{item.sessions} sessions</Text>
            </View>
            <Text style={styles.score}>{item.total_score}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f9' },
  pad: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#1f3a5f' },
  sub: { color: '#5b6573', marginBottom: 12 },
  link: { color: '#1f3a5f', fontWeight: '600' },
  form: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d5d9df', padding: 12, marginBottom: 10 },
  btn: { backgroundColor: '#1f3a5f', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 10 },
  btnAlt: { backgroundColor: '#e3e9f2' },
  btnText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, gap: 12 },
  me: { borderWidth: 2, borderColor: '#1f3a5f' },
  rank: { width: 24, fontWeight: '800', color: '#1f3a5f', fontSize: 18 },
  name: { fontWeight: '700', fontSize: 16 },
  score: { fontWeight: '800', fontSize: 20, color: '#1f3a5f' },
});
