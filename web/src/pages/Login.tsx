import { useState } from 'react';
import { Box, Button, Paper, Text, TextInput, Title } from '@mantine/core';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <Box className="hero brand-backdrop">
      <Paper shadow="lg" p={{ base: 'lg', sm: 30 }} maw={420} w="100%">
        <Title order={1} ta="center" fz={{ base: 30, sm: 36 }}>
          Pranjal{' '}
          <Text span inherit c="rose.6" fs="italic">
            &amp;
          </Text>{' '}
          Paridhi
        </Title>
        <div className="page-ornament" style={{ margin: '10px auto 0' }} aria-hidden />
        <Text c="dimmed" size="sm" ta="center" mt="sm">
          Our wedding planner. Sign in with your email.
        </Text>

        <Box mt="xl">
          {sent ? (
            <Text ta="center">
              💌 Check your email for a sign-in link.
            </Text>
          ) : (
            <form onSubmit={handleSubmit}>
              <TextInput
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              {error && (
                <Text c="red" size="sm" mt="sm">
                  {error}
                </Text>
              )}
              <Button type="submit" fullWidth mt="xl" loading={sending}>
                Send magic link
              </Button>
            </form>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
