'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Clock,
  Coffee,
  DoorOpen,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  Home,
  KeyRound,
  Lightbulb,
  ListChecks,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  Users,
  TriangleAlert,
} from 'lucide-react';
import type { GuideIconName, UserGuideContent } from '@/lib/user-guides';
import { getUserGuide } from '@/lib/user-guides';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ICONS: Record<GuideIconName, ComponentType<{ className?: string }>> = {
  calendar: CalendarDays,
  chart: BarChart3,
  clock: Clock,
  coffee: Coffee,
  download: Download,
  door: DoorOpen,
  eye: Eye,
  file: FileText,
  filter: Filter,
  flag: Flag,
  key: KeyRound,
  lock: Lock,
  mail: Mail,
  pencil: Pencil,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  send: Send,
  settings: Settings,
  shield: Shield,
  star: Star,
  trash: Trash2,
  upload: Upload,
  user: UserRound,
  users: Users,
  warning: TriangleAlert,
  check: CheckCircle2,
  home: Home,
};

export type UserGuideVariant = 'sidebar' | 'header' | 'compact' | 'icon';

export function UserGuide({
  variant = 'header',
  className,
}: {
  variant?: UserGuideVariant;
  className?: string;
}) {
  const pathname = usePathname();
  const guide = getUserGuide(pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!guide) return null;

  const PageIcon = ICONS[guide.icon];

  return (
    <>
      <GuideTrigger
        variant={variant}
        pageTitle={guide.title}
        className={className}
        onClick={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(88vh,840px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <div className="h-1.5 shrink-0 oi-gradient-bg" />
          <DialogHeader className="shrink-0 space-y-0 border-b px-6 pb-4 pt-5 pr-12 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PageIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  User Guide
                </p>
                <DialogTitle className="mt-0.5 text-xl">{guide.title}</DialogTitle>
                <DialogDescription className="mt-1">{guide.tagline}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <GuideBody guide={guide} onNavigate={() => setOpen(false)} />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/40 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to
              close
            </p>
            <Button size="sm" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GuideTrigger({
  variant,
  pageTitle,
  className,
  onClick,
}: {
  variant: UserGuideVariant;
  pageTitle: string;
  className?: string;
  onClick: () => void;
}) {
  if (variant === 'sidebar' || variant === 'header') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 rounded-md border border-primary/15 bg-primary/5 px-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/10',
          variant === 'sidebar' && 'w-full',
          className,
        )}
      >
        <CircleHelp className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-primary">User Guide</span>
          <span className="block truncate text-xs text-muted-foreground">How to use {pageTitle}</span>
        </span>
      </button>
    );
  }
  if (variant === 'compact' || variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('text-muted-foreground', className)}
        onClick={onClick}
      >
        <CircleHelp className="h-4 w-4" />
        Guide
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={onClick}>
      <CircleHelp className="h-4 w-4" />
      User Guide
    </Button>
  );
}

function GuideBody({
  guide,
  onNavigate,
}: {
  guide: UserGuideContent;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-7">
      <p className="text-sm leading-relaxed text-foreground/90">{guide.summary}</p>

      <section>
        <SectionLabel icon={Sparkles} title="What you can do here" />
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {guide.canDo.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border bg-card p-3 shadow-sm"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {guide.howTo.map((flow) => (
        <section key={flow.title}>
          <SectionLabel icon={ListChecks} title={flow.title} />
          <ol className="mt-3 space-y-3">
            {flow.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium leading-snug">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {guide.tips && guide.tips.length > 0 && (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <SectionLabel icon={Lightbulb} title="Good to know" />
          <ul className="mt-3 space-y-2">
            {guide.tips.map((tip) => (
              <li key={tip} className="flex gap-2 text-xs leading-relaxed text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {guide.related && guide.related.length > 0 && (
        <section>
          <SectionLabel icon={ArrowRight} title="Related" />
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.related.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                {item.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </h3>
  );
}
