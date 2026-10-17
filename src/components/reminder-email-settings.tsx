import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getReminderEmailStatus, sendTestReminder } from '@/lib/reminders.functions';

export function ReminderEmailSettings({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const statusFn = useServerFn(getReminderEmailStatus);
  const testFn = useServerFn(sendTestReminder);
  const status = useQuery({ queryKey: ['reminder-email-status'], queryFn: () => statusFn(), refetchOnWindowFocus: true });
  const [busy, setBusy] = useState(false);
  async function sendTest() {
    setBusy(true);
    try { const result = await testFn(); if (result.sent) toast.success(result.message); else toast.info(result.message); }
    catch { toast.error('The test reminder could not be sent. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 sm:col-span-2 border-t border-border pt-5">
    <div className="flex items-center justify-between gap-4"><Label htmlFor="email-reminders">Email reminders</Label><Switch id="email-reminders" checked={enabled} onCheckedChange={onChange} /></div>
    <p className="text-sm text-muted-foreground">Email me once about each upcoming subscription renewal or trial end within my selected reminder window, using my time zone. Off by default; save settings to apply changes.</p>
    <p className="text-sm text-muted-foreground" role="status">{status.isPending ? 'Checking email availability…' : status.isError ? 'Email availability could not be checked. Please retry.' : status.data.connected ? 'Email provider connected.' : 'Email provider not connected yet. No emails will be sent until a provider and verified sender are configured.'}</p>
    <Button type="button" variant="outline" disabled={busy || status.isPending || status.isError} onClick={() => void sendTest()}><Mail />{busy ? 'Sending…' : 'Send me a test reminder'}</Button>
  </div>;
}