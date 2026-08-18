'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Bug, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MailProblemReportPolicy, ProblemReportResult } from '@ttah/shared';
import { api, apiUpload, ApiRequestError } from '@/lib/api';
import { capturePageJpeg } from '@/lib/capture-page';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MIN_CHARS = 10;
const MAX_CHARS = 2000;

function isPublicAuthPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/reset-password');
}

export function ProblemReportHost() {
  const pathname = usePathname();
  const publicPage = isPublicAuthPath(pathname);
  const { data: session } = useSession({ enabled: !publicPage });
  if (publicPage || !session) return null;
  return <ProblemReportFab />;
}

function ProblemReportFab() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [intendedAction, setIntendedAction] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [expected, setExpected] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [viewport, setViewport] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const screenshotRef = useRef<Blob | null>(null);

  const policy = useQuery({
    queryKey: ['mail', 'problem-report-policy'],
    queryFn: () => api<MailProblemReportPolicy>('/mail/problem-report-policy'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const valid = useMemo(() => {
    const fields = [intendedAction, whatHappened, expected];
    return fields.every((value) => {
      const len = value.trim().length;
      return len >= MIN_CHARS && len <= MAX_CHARS;
    });
  }, [intendedAction, whatHappened, expected]);

  const resetForm = () => {
    screenshotRef.current = null;
    setIntendedAction('');
    setWhatHappened('');
    setExpected('');
    setPageUrl('');
    setViewport('');
    setPreviewUrl(null);
  };

  const openDialog = async () => {
    if (picking) return;
    setPicking(true);
    setPageUrl(window.location.href);
    setViewport(`${window.innerWidth}x${window.innerHeight}`);
    screenshotRef.current = null;
    setPreviewUrl(null);
    try {
      const blob = await capturePageJpeg();
      screenshotRef.current = blob;
      setPreviewUrl(blob ? URL.createObjectURL(blob) : null);
    } finally {
      setPicking(false);
      setOpen(true);
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('intendedAction', intendedAction.trim());
      form.append('whatHappened', whatHappened.trim());
      form.append('expected', expected.trim());
      form.append('pageUrl', pageUrl);
      form.append('viewport', viewport);
      if (screenshotRef.current) {
        form.append('screenshot', screenshotRef.current, 'screenshot.jpg');
      }
      return apiUpload<ProblemReportResult>('/mail/problem-report', form);
    },
    onSuccess: (data) => {
      toast({
        title: `Report sent · ${data.id}`,
        description: 'The development team received your note and a screenshot of what you were looking at.',
        variant: 'success',
      });
      setOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast({
        title: 'Could not send the report',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const canSend = policy.data?.canSend !== false;
  const configured = policy.data?.canSend === true;

  return (
    <>
      {!open && (
        <button
          type="button"
          data-ttah-problem-report="fab"
          onClick={() => void openDialog()}
          disabled={picking}
          className={cn(
            'fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-3.5',
            'text-primary-foreground shadow-lg transition-colors hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            picking && 'opacity-80',
          )}
          aria-label="Report a problem"
          title="Report a problem"
        >
          {picking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bug className="h-5 w-5" />}
          <span className="hidden pr-1 text-sm font-medium sm:inline">
            {picking ? 'Capturing…' : 'Report a problem'}
          </span>
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (send.isPending) return;
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[min(88vh,720px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Tell us what you were doing. We include a screenshot of this tab and your account so
              we can find the screen.
            </DialogDescription>
          </DialogHeader>

          {!configured && !policy.isLoading && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Problem reports are not configured yet. Ask an admin to set a recipient under Mail →
              Problem reports.
            </p>
          )}

          <div className="grid gap-4">
            <Field
              id="problem-intended"
              label="What did you want to do?"
              value={intendedAction}
              onChange={setIntendedAction}
            />
            <Field
              id="problem-happened"
              label="What happened?"
              value={whatHappened}
              onChange={setWhatHappened}
            />
            <Field
              id="problem-expected"
              label="What should have happened?"
              value={expected}
              onChange={setExpected}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Screenshot</p>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Screenshot of this tab"
                  className="max-h-48 w-full rounded-md border bg-muted object-contain object-top"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No screenshot attached. The report will still be sent with the details above.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The image is this browser tab as you shared it, which may include employee data.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={send.isPending}
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!valid || send.isPending || !canSend}
              onClick={() => send.mutate()}
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const len = value.trim().length;
  const tooShort = len > 0 && len < MIN_CHARS;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        maxLength={MAX_CHARS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      <p className={cn('text-xs', tooShort ? 'text-destructive' : 'text-muted-foreground')}>
        {tooShort ? `Add a little more (${MIN_CHARS - len} more characters).` : `${len}/${MAX_CHARS}`}
      </p>
    </div>
  );
}
