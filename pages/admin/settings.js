import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function useAdminPassword() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_password');
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const adminPassword = useAdminPassword();

  useEffect(() => {
    if (!adminPassword) {
      router.replace('/admin');
      return;
    }
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const res = await fetch('/api/admin/settings', {
      headers: { 'x-admin-password': adminPassword }
    });
    if (res.status === 401) {
      localStorage.removeItem('admin_password');
      router.replace('/admin');
      return;
    }
    const j = await res.json();
    if (j.ok) setSettings(j.settings || {});
    setLoading(false);
  }

  function onChange(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify(settings)
    });
    const j = await res.json();
    if (!j.ok) {
      alert('Save error: ' + (j.message || 'unknown'));
    } else {
      alert('Settings saved');
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <main style={{ maxWidth: 800, margin: '32px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>App Settings</h1>
      <p>Enter your keys and settings below. Sensitive values are encrypted in the database if APP_ENCRYPTION_KEY is set.</p>
      <form onSubmit={save}>
        <label>Telegram Bot Token</label>
        <input style={{ width: '100%', padding: 8, marginBottom: 12 }} value={settings.TELEGRAM_BOT_TOKEN || ''} onChange={e => onChange('TELEGRAM_BOT_TOKEN', e.target.value)} />

        <label>Xendit API Key (secret)</label>
        <input style={{ width: '100%', padding: 8, marginBottom: 12 }} value={settings.XENDIT_API_KEY || ''} onChange={e => onChange('XENDIT_API_KEY', e.target.value)} />

        <label>Xendit Callback Token</label>
        <input style={{ width: '100%', padding: 8, marginBottom: 12 }} value={settings.XENDIT_CALLBACK_TOKEN || ''} onChange={e => onChange('XENDIT_CALLBACK_TOKEN', e.target.value)} />

        <label>VERCEL_URL (your deployment domain, e.g. myapp.vercel.app)</label>
        <input style={{ width: '100%', padding: 8, marginBottom: 12 }} value={settings.VERCEL_URL || ''} onChange={e => onChange('VERCEL_URL', e.target.value)} />

        <label>Optional: XENDIT_MODE (test|live)</label>
        <input style={{ width: '100%', padding: 8, marginBottom: 12 }} value={settings.XENDIT_MODE || ''} onChange={e => onChange('XENDIT_MODE', e.target.value)} />

        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={saving} style={{ padding: '8px 12px' }}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </main>
  );
}
