import { useState } from 'react';
import { Button, Container, Paper, Text, TextInput, Title } from '@mantine/core';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">PwP Wedding Planner</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        For Pranjal &amp; Paridhi only — sign in with your email.
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        {sent ? (
          <Text ta="center">Check your email for a sign-in link.</Text>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Email"
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
            <Button type="submit" fullWidth mt="xl">
              Send magic link
            </Button>
          </form>
        )}
      </Paper>
    </Container>
  );
}
