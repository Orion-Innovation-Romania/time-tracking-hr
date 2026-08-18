'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, Mail, Save, Send, ShieldCheck } from 'lucide-react';
import type { MailConfigView, SendTestMailInput } from '@ttah/shared';
import { api, ApiRequestError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/ui/toast';
import { UserGuide } from '@/components/user-guide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export default function MailAdminPage() {
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [authority, setAuthority] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('');
  const [senderMailbox, setSenderMailbox] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [reportRecipient, setReportRecipient] = useState('');
  const [sendReportByDefault, setSendReportByDefault] = useState(false);
  const [problemReportRecipient, setProblemReportRecipient] = useState('');

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('TTAH mail test');
  const [body, setBody] = useState('This is a test email from TTAH.');

  useEffect(() => {
    if (!sessionLoading && session && session.role !== 'admin') {
      router.replace('/time-tracking/dashboard');
    }
  }, [session, sessionLoading, router]);

  const config = useQuery({
    queryKey: ['mail', 'config'],
    queryFn: () => api<MailConfigView>('/mail/config'),
    enabled: session?.role === 'admin',
  });

  useEffect(() => {
    if (!config.data) return;
    setAuthority(config.data.authority);
    setClientId(config.data.clientId);
    setScope(config.data.scope);
    setSenderMailbox(config.data.senderMailbox);
    setFromAddress(config.data.fromAddress);
    setFromName(config.data.fromName);
    setReportRecipient(config.data.reportRecipient);
    setSendReportByDefault(config.data.sendReportByDefault);
    setProblemReportRecipient(config.data.problemReportRecipient ?? '');
  }, [config.data]);

  const save = useMutation({
    mutationFn: () =>
      api<MailConfigView>('/mail/config', {
        method: 'PUT',
        body: {
          authority,
          clientId,
          scope,
          senderMailbox,
          fromAddress,
          fromName,
          reportRecipient,
          sendReportByDefault,
          problemReportRecipient,
          ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['mail', 'config'], data);
      queryClient.invalidateQueries({ queryKey: ['mail', 'report-policy'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'problem-report-policy'] });
      setClientSecret('');
      toast({ title: 'Mail settings saved', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const verify = useMutation({
    mutationFn: () => api<{ ok: true; expiresIn: number }>('/mail/verify', { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: 'Graph token acquired',
        description: `Token is valid for about ${Math.round(data.expiresIn / 60)} minutes.`,
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({
        title: 'Connection failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const sendTest = useMutation({
    mutationFn: (payload: SendTestMailInput) =>
      api<{ ok: true }>('/mail/test', { method: 'POST', body: payload }),
    onSuccess: () => {
      toast({
        title: 'Test email sent',
        description: `Sent to ${to}`,
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({
        title: 'Send failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  if (sessionLoading || session?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const view = config.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mail</h1>
          <p className="text-sm text-muted-foreground">
            Send mail through Microsoft Graph, same as Inventory. Configure the Azure app and
            mailbox, then send a test message.
          </p>
        </div>
        <UserGuide variant="header" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Status
          </CardTitle>
          <CardDescription>
            Uses the Inventory Graph application (Mail.Send) and the shared mailbox below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {config.isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <>
              <Badge variant={view?.configured ? 'default' : 'destructive'}>
                {view?.configured ? 'configured' : 'incomplete'}
              </Badge>
              <Badge variant={view?.hasClientSecret ? 'secondary' : 'outline'}>
                {view?.hasClientSecret ? 'client secret set' : 'no client secret'}
              </Badge>
              {view?.fromName && (
                <span className="text-sm text-muted-foreground">as {view.fromName}</span>
              )}
              {view?.reportRecipient && (
                <span className="text-sm text-muted-foreground">
                  reports → {view.reportRecipient}
                  {view.sendReportByDefault ? ' (default on)' : ''}
                </span>
              )}
              {view?.problemReportRecipient && (
                <span className="text-sm text-muted-foreground">
                  problems → {view.problemReportRecipient}
                </span>
              )}
              {view?.senderMailbox && (
                <span className="text-sm text-muted-foreground">Send as {view.senderMailbox}</span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender appearance</CardTitle>
          <CardDescription>
            This is the name recipients see in Outlook (the blue name next to the avatar), not the
            email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mail-from-name">From display name</Label>
              <Input
                id="mail-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="DPD-ROU-Hr-Recruitment"
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <p className="flex h-10 items-center text-sm text-muted-foreground">
                {fromName.trim() || 'Mailbox default'}
                {fromAddress ? ` <${fromAddress}>` : ''}
              </p>
            </div>
            <div>
              <Button type="submit" disabled={save.isPending || config.isLoading}>
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save name
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report delivery</CardTitle>
          <CardDescription>
            When someone generates an export, TTAH can also email the file to this address. The
            download still happens in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail-report-to">Report recipient</Label>
              <Input
                id="mail-report-to"
                type="text"
                value={reportRecipient}
                onChange={(e) => setReportRecipient(e.target.value)}
                placeholder="hr@orioninc.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                One address, or several separated by commas.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sendReportByDefault}
                onChange={(e) => setSendReportByDefault(e.target.checked)}
              />
              Email reports by default when they are generated
            </label>
            <div>
              <Button type="submit" disabled={save.isPending || config.isLoading}>
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save delivery
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problem reports</CardTitle>
          <CardDescription>
            Where “Report a problem” emails go. This is the development team, not the HR export
            recipients above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail-problem-to">Dev team recipient</Label>
              <Input
                id="mail-problem-to"
                type="text"
                value={problemReportRecipient}
                onChange={(e) => setProblemReportRecipient(e.target.value)}
                placeholder="dev@orioninc.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                One address, or several separated by commas. Users send a screenshot of what they
                currently see, plus what they wanted, what happened, and what should have happened.
              </p>
            </div>
            <div>
              <Button type="submit" disabled={save.isPending || config.isLoading}>
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save recipients
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-6 [&::-webkit-details-marker]:hidden">
            <div>
              <CardTitle className="text-base">Graph configuration</CardTitle>
              <CardDescription className="mt-1.5">
                Azure app credentials and mailbox. Closed by default — open only if you need to
                change them.
              </CardDescription>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <CardContent>
            {config.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="mail-authority">Authority</Label>
                  <Input
                    id="mail-authority"
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-client-id">Client ID</Label>
                  <Input
                    id="mail-client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-client-secret">Client secret</Label>
                  <Input
                    id="mail-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={
                      view?.hasClientSecret ? 'Leave blank to keep current secret' : 'Required'
                    }
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="mail-scope">Scope</Label>
                  <Input
                    id="mail-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-mailbox">Sender mailbox</Label>
                  <Input
                    id="mail-mailbox"
                    type="email"
                    value={senderMailbox}
                    onChange={(e) => setSenderMailbox(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail-from">From address</Label>
                  <Input
                    id="mail-from"
                    type="email"
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={verify.isPending}
                    onClick={() => verify.mutate()}
                  >
                    {verify.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Verify token
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </details>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send test email</CardTitle>
          <CardDescription>
            Sends a branded HTML message through Graph — same look as welcome and report emails.
            Use this before wiring mail into other flows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendTest.mutate({ to, cc: cc || undefined, subject, body });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mail-to">To</Label>
              <Input
                id="mail-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-cc">CC (optional)</Label>
              <Input
                id="mail-cc"
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail-subject">Subject</Label>
              <Input
                id="mail-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail-body">Body</Label>
              <Textarea
                id="mail-body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div>
              <Button type="submit" disabled={sendTest.isPending || !view?.configured}>
                {sendTest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send test
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
