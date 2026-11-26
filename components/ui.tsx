import { ReactNode, useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { c } from '../theme';

export function Button({
  title, onPress, loading, disabled, variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' ? s.primary : s.ghost,
        off && s.off,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.ball : c.primary} />
      ) : (
        <Text style={[s.btnText, variant === 'ghost' && { color: c.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label, error, right, ...input
}: TextInputProps & { label: string; error?: string; right?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.focus, !!error && s.err]}>
        <TextInput
          {...input}
          style={s.input}
          placeholderTextColor="#9AA6A0"
          onFocus={() => setFocused(true)}
          onBlur={(e) => {setFocused(false); input.onBlur?.(e); }}
        />
        {right}
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: c.primary },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  off: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: c.muted, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
    borderWidth: 1.5, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14,
  },
  focus: { borderColor: c.primary },
  err: { borderColor: c.error },
  input: { flex: 1, height: 50, fontSize: 16, color: c.ink },
  error: { color: c.error, fontSize: 13, marginTop: 6 },
});