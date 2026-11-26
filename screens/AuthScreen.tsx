import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Field } from '../components/ui';
import { c } from '../theme';

type Mode = 'welcome' | 'signup' | 'signin';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });

  const touch = (k: 'name' | 'email') => () => setTouched((t) => ({ ...t, [k]: true }));
  const nameOk = name.trim().length >= 2;
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const lenOk = password.length >= 8;
  const numOk = /\d/.test(password);
  const pwOk = lenOk && numOk;

  function go(next: Mode) {
    setMode(next);
    setStep(1);
    setTried(false);
    setFormError('');
    setNotice('');
  }

  function nextStep() {
    setTried(true);
    if (nameOk && emailOk) {
      setTried(false);
      setStep(2);
    }
  }

  async function signUp() {
    if (!pwOk) { setTried(true); return; }
    setBusy(true);
    setFormError('');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setBusy(false);
    if (error) { setFormError(error.message); return; }
    if (!data.session) {
      setNotice('Check your inbox to confirm your email, then sign in.');
      setMode('signin');
      setStep(1);
      setTried(false);
    }
  }

  async function signIn() {
    setTried(true);
    if (!emailOk || !password) return;
    setBusy(true);
    setFormError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setFormError(error.message);
  }

  async function forgot() {
  if (!emailOk) { setTried(true); return; }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  setNotice(error ? error.message : 'If that email has an account, a reset link is on its way.');
  }

  if (mode === 'welcome') {
    return (
      <View style={s.welcome}>
        <View style={s.ball} />
        <Text style={s.brand}>Reps</Text>
        <Text style={s.tag}>Log every drill. Climb the board.</Text>
        <View style={{ flex: 1 }} />
        <Button title="Create account" onPress={() => go('signup')} />
        <View style={{ height: 10 }} />
        <Button title="I already have an account" variant="ghost" onPress={() => go('signin')} />
      </View>
    );
  }

  const signup = mode === 'signup';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (signup && step === 2 ? setStep(1) : go('welcome'))} hitSlop={12}>
          <Text style={s.back}>Back</Text>
        </Pressable>

        {signup && <Text style={s.step}>Step {step} of 2</Text>}
        <Text style={s.title}>
          {!signup ? 'Welcome back' : step === 1 ? 'Create your account' : 'Choose a password'}
        </Text>

        {!!notice && <Text style={s.notice}>{notice}</Text>}

        {(!signup || step === 1) && (
          <>
            {signup && (
              <Field
                label="Your name"
                placeholder="Alex Mwangi"
                value={name}
                onChangeText={setName}
                onBlur={touch('name')}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                error={(tried || touched.name) && !nameOk ? 'Enter at least 2 characters.' : undefined}
              />
            )}
            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              onBlur={touch('email')}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              error={(tried || touched.email) && !emailOk ? 'Enter a valid email address.' : undefined}
            />
          </>
        )}

        {(!signup || step === 2) && (
          <>
            <Field
              label="Password"
              placeholder={signup ? 'At least 8 characters' : 'Your password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete={signup ? 'new-password' : 'current-password'}
              textContentType={signup ? 'newPassword' : 'password'}
              right={
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
                  <Text style={s.toggle}>{show ? 'Hide' : 'Show'}</Text>
                </Pressable>
              }
              error={!signup && tried && !password ? 'Enter your password.' : undefined}
            />
            
            {!signup && (
              <Pressable onPress={forgot} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
                <Text style={s.toggle}>Forgot password?</Text>
              </Pressable>
            )}

            {signup && (
              <View style={{ marginBottom: 14 }}>
                <Rule ok={lenOk} text="8 or more characters" />
                <Rule ok={numOk} text="Includes a number" />
              </View>
            )}
          </>
        )}

        {!!formError && <Text style={s.formError}>{formError}</Text>}

        <View style={{ height: 6 }} />
        {signup ? (
          step === 1 ? (
            <Button title="Continue" onPress={nextStep} />
          ) : (
            <Button title="Create account" onPress={signUp} loading={busy} disabled={!pwOk} />
          )
        ) : (
          <Button title="Sign in" onPress={signIn} loading={busy} />
        )}

        <Pressable onPress={() => go(signup ? 'signin' : 'signup')} style={{ marginTop: 18 }}>
          <Text style={s.switch}>
            {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Text style={[s.rule, ok && { color: c.ok, fontWeight: '600' }]}>
      {ok ? '\u2713' : '\u25CB'}  {text}
    </Text>
  );
}

const s = StyleSheet.create({
  welcome: { flex: 1, padding: 24, paddingTop: 80 },
  ball: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.ball, marginBottom: 20 },
  brand: { fontSize: 56, fontWeight: '900', color: c.primary, letterSpacing: -1.5 },
  tag: { fontSize: 18, color: c.muted, marginTop: 8 },
  form: { padding: 24, paddingTop: 16 },
  back: { color: c.primary, fontWeight: '600', fontSize: 15, marginBottom: 18 },
  step: { color: c.muted, fontSize: 13, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '800', color: c.ink, marginBottom: 22 },
  notice: { backgroundColor: '#E8F3EC', color: c.primary, padding: 12, borderRadius: 10, marginBottom: 16 },
  toggle: { color: c.primary, fontWeight: '700' },
  rule: { color: c.muted, fontSize: 14, marginBottom: 4 },
  formError: { color: c.error, fontSize: 14, marginBottom: 8 },
  switch: { textAlign: 'center', color: c.primary, fontWeight: '600' },
});