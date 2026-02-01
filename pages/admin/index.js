import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.message || 'Login failed');
        return;
      }
      localStorage.setItem('admin_password', password);
      router.push('/admin/settings');
    } catch (err) {
      setError(err.message || 'error');
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Admin Login</h1>
      <p>Enter the ADMIN_PASSWORD you set in Vercel environment variables.</p>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin password" style={{ width: '100%', padding: 8 }} />
        </div>
        <div>
          <button type="submit" style={{ padding: '8px 12px' }}>Login</button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
