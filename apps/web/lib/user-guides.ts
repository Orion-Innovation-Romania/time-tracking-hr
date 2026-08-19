export type GuideIconName =
  | 'calendar'
  | 'chart'
  | 'clock'
  | 'coffee'
  | 'download'
  | 'door'
  | 'eye'
  | 'file'
  | 'filter'
  | 'flag'
  | 'key'
  | 'lock'
  | 'mail'
  | 'pencil'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'send'
  | 'settings'
  | 'shield'
  | 'star'
  | 'trash'
  | 'upload'
  | 'user'
  | 'users'
  | 'warning'
  | 'check'
  | 'home';

export interface GuideAction {
  icon: GuideIconName;
  title: string;
  description: string;
}

export interface GuideStep {
  title: string;
  description: string;
}

export interface GuideHowTo {
  title: string;
  steps: GuideStep[];
}

export interface GuideRelated {
  href: string;
  label: string;
}

export interface UserGuideContent {
  title: string;
  tagline: string;
  summary: string;
  icon: GuideIconName;
  canDo: GuideAction[];
  howTo: GuideHowTo[];
  tips?: string[];
  related?: GuideRelated[];
}

const GUIDES: Record<string, UserGuideContent> = {
  '/': {
    title: 'Portal home',
    tagline: 'Pick an app and get to work',
    summary:
      'This is the TTAH landing page. From here you open Time Tracking or sign out. Administrators also see System Resources.',
    icon: 'home',
    canDo: [
      {
        icon: 'clock',
        title: 'Open Time Tracking',
        description: 'Analyze badge logs, review presence, and build timesheets.',
      },
      {
        icon: 'chart',
        title: 'System Resources (admin)',
        description: 'Live CPU, memory and disk plus 90 days of history for this machine.',
      },
      {
        icon: 'lock',
        title: 'Sign out',
        description: 'End your session from the header. You will need to sign in again next time.',
      },
    ],
    howTo: [
      {
        title: 'Start working',
        steps: [
          {
            title: 'Click Time Tracking',
            description: 'Opens the dashboard. The other card is a placeholder for future apps.',
          },
          {
            title: 'Admins: open System Resources',
            description: 'Check whether this host has enough CPU, RAM and disk. History is stored every minute.',
          },
          {
            title: 'Use the left menu',
            description:
              'Once inside Time Tracking, every page has its own User Guide — open it whenever you need a quick reminder.',
          },
        ],
      },
    ],
    tips: [
      'Your username is shown in the header. Admins also see a shield icon.',
      'System Resources is visible only to admin accounts.',
    ],
  },

  '/system': {
    title: 'System Resources',
    tagline: 'Is this machine enough?',
    summary:
      'Live CPU, memory and disk for the host running the TTAH API, plus history sampled every minute and kept for 90 days. Admin only.',
    icon: 'chart',
    canDo: [
      {
        icon: 'chart',
        title: 'Read live utilization',
        description: 'CPU, RAM and disk update every few seconds. OK / Watch / Critical use 75% and 90% thresholds.',
      },
      {
        icon: 'calendar',
        title: 'Review history',
        description: 'Switch 1h–30d to see whether a spike was brief or the machine is chronically tight.',
      },
      {
        icon: 'settings',
        title: 'Check the host',
        description: 'Hostname, OS, container vs VM, API process RSS, and uptime.',
      },
    ],
    howTo: [
      {
        title: 'Judge capacity',
        steps: [
          {
            title: 'Look at the three gauges',
            description: 'If any stay in Watch or Critical after a quiet period, the host is undersized.',
          },
          {
            title: 'Open 7d or 30d',
            description: 'Peaks during imports/exports are normal. A high baseline all day is not.',
          },
        ],
      },
    ],
    tips: [
      'In Docker the numbers are what the API container sees (cgroup limits when set).',
      'The first history points appear about a minute after the API starts.',
    ],
    related: [{ href: '/', label: 'Portal home' }],
  },

  '/login': {
    title: 'Sign in',
    tagline: 'Access the TTAH Portal',
    summary:
      'Use the username and password given by an administrator. If this is your first login, you will be asked to set a new password right after.',
    icon: 'lock',
    canDo: [
      {
        icon: 'key',
        title: 'Sign in',
        description: 'Enter username and password, then click Sign in.',
      },
      {
        icon: 'mail',
        title: 'Forgot password',
        description:
          'Enter the email on your account. You get a link by email and set a new password yourself. No admin approval.',
      },
    ],
    howTo: [
      {
        title: 'If you forgot your password',
        steps: [
          {
            title: 'Click Forgot password?',
            description: 'The email field appears under the sign-in form.',
          },
          {
            title: 'Enter your TTAH email',
            description: 'This is the email an admin saved on your user account, not your username.',
          },
          {
            title: 'Open the email and set a new password',
            description:
              'The link is valid for one hour and can be used once. Then sign in with the new password.',
          },
        ],
      },
    ],
    tips: [
      'Passwords must be at least 10 characters, with a letter and a digit.',
      'The same confirmation is shown whether or not the email is registered — this is intentional.',
      'Check spam if the message does not arrive within a minute. Ask an admin only if you cannot access that mailbox.',
    ],
  },

  '/change-password': {
    title: 'Set a new password',
    tagline: 'Required after first login or an admin reset',
    summary:
      'You must choose your own password before using the portal. This screen appears automatically when the account still has the initial password. It is not used for “forgot password” — that flow goes through email.',
    icon: 'key',
    canDo: [
      {
        icon: 'lock',
        title: 'Update your password',
        description: 'Enter the current (initial) password, then a new one twice.',
      },
    ],
    howTo: [
      {
        title: 'Choose a valid password',
        steps: [
          {
            title: 'Current password',
            description: 'The initial password from your admin, or the one you used to sign in.',
          },
          {
            title: 'New password',
            description: 'At least 10 characters, with at least one letter and one digit.',
          },
          {
            title: 'Confirm and update',
            description: 'Both new fields must match. You are then sent to the portal home.',
          },
        ],
      },
    ],
    tips: [
      'Do not reuse the initial password. You will be asked to change it again.',
      'If you forgot the password and cannot sign in, use Forgot password on the login page instead.',
    ],
    related: [{ href: '/login', label: 'Sign in' }],
  },

  '/reset-password': {
    title: 'Reset password',
    tagline: 'Set a new password from the email link',
    summary:
      'This page opens from the reset link in your email. You choose a new password here. You do not need the old one, and an admin does not need to approve it.',
    icon: 'key',
    canDo: [
      {
        icon: 'lock',
        title: 'Save a new password',
        description: 'Enter it twice, then you are sent to sign in.',
      },
    ],
    howTo: [
      {
        title: 'Finish the reset',
        steps: [
          {
            title: 'Open the link from your email',
            description: 'It works for one hour and only once.',
          },
          {
            title: 'Choose a valid password',
            description: 'At least 10 characters, with at least one letter and one digit. It must differ from the old one.',
          },
          {
            title: 'Sign in',
            description: 'Use your username and the password you just set.',
          },
        ],
      },
    ],
    tips: [
      'If the link is expired or already used, request a new one from Forgot password on the sign-in page.',
    ],
    related: [{ href: '/login', label: 'Sign in' }],
  },

  '/time-tracking/dashboard': {
    title: 'Dashboard',
    tagline: 'Office presence at a glance',
    summary:
      'A read-only overview of who came in, how long they worked, break time, punctuality, and daily badge summaries. Nothing here edits data — it only shows what the engine already computed.',
    icon: 'chart',
    canDo: [
      {
        icon: 'calendar',
        title: 'Change the date range',
        description: 'From / To at the top right. Defaults to the current month. All charts and tables follow this range.',
      },
      {
        icon: 'search',
        title: 'Filter or compare people',
        description:
          'Use the search under the title to pick one or more employees. The whole dashboard then shows only those people.',
      },
      {
        icon: 'users',
        title: 'Read the KPI cards',
        description:
          'Employees present, days present, total worked (with daily average), average break per day, and anomaly count.',
      },
      {
        icon: 'chart',
        title: 'Weekly attendance',
        description:
          'Average hours worked per day vs the 8h target, plus people present, days/person, and how many days reached 8h.',
      },
      {
        icon: 'coffee',
        title: 'Worked vs break',
        description:
          'Per employee, average hours actually worked (blue) vs break time between first in and last out (amber).',
      },
      {
        icon: 'clock',
        title: 'Punctuality',
        description:
          'Average arrival vs the scheduled start from Configuration. Sorted by worst average lateness. On-time % is color-coded.',
      },
      {
        icon: 'file',
        title: 'Daily summaries',
        description:
          'One row per person per day: first in, last out, worked, break, lunch, and flags. Up to 200 most recent rows.',
      },
    ],
    howTo: [
      {
        title: 'Review a month',
        steps: [
          {
            title: 'Set From and To',
            description: 'Usually the first and last day of the month you care about.',
          },
          {
            title: 'Scan the five KPIs',
            description: 'A high Anomalies number means you should open the Anomalies page next.',
          },
          {
            title: 'Check weekly and per-person charts',
            description: 'The green dashed line is the 8-hour full-day target.',
          },
          {
            title: 'Use the daily table for details',
            description:
              'Click a flag badge to open the day’s badge timeline and why it was raised. Up to 200 most recent rows.',
          },
        ],
      },
    ],
    tips: [
      'If everything is empty, import an AxTraxNG PDF or CSV on the Import page first.',
      'Punctuality uses the global start time from Configuration → Schedule & lunch (or the employee override).',
      'Break time is only shown when both a first-in and a last-out exist for that day.',
      'This page never changes data. Corrections are made on Anomalies; door roles on Doors.',
    ],
    related: [
      { href: '/time-tracking/import', label: 'Import a report' },
      { href: '/time-tracking/anomalies', label: 'Review anomalies' },
      { href: '/time-tracking/exports', label: 'Export a timesheet' },
    ],
  },

  '/time-tracking/import': {
    title: 'Import',
    tagline: 'Load AxTraxNG access reports',
    summary:
      'This is how attendance data gets into TTAH. You upload an AxTraxNG PDF (one person) or CSV (all employees), preview what was parsed, then commit. History lets you undo a bad import.',
    icon: 'upload',
    canDo: [
      {
        icon: 'upload',
        title: 'Upload a PDF or CSV',
        description:
          'Drag and drop onto the dashed card, or click Choose file. PDFs are one employee; CSV Access Reports include everyone in the export.',
      },
      {
        icon: 'eye',
        title: 'Preview before saving',
        description:
          'See rows parsed, newly discovered doors, warnings, and whether this exact file was already imported.',
      },
      {
        icon: 'user',
        title: 'Assign the employee (PDF)',
        description:
          'Pick an existing person, or type a name to create one. The report header is used when it contains a name.',
      },
      {
        icon: 'users',
        title: 'Import everyone (CSV)',
        description:
          'A multi-employee CSV matches or creates each User Name automatically. You can upload a later export the same day — existing badge reads are skipped.',
      },
      {
        icon: 'check',
        title: 'Commit the import',
        description: 'Writes events, creates employees/doors if needed, and rebuilds daily summaries.',
      },
      {
        icon: 'trash',
        title: 'Delete a batch',
        description: 'The trash icon on a history row removes that import and its events.',
      },
    ],
    howTo: [
      {
        title: 'Import one report',
        steps: [
          {
            title: 'Drop or choose the file',
            description:
              'PDF or CSV. Wait for the preview card. If parsing fails, the file is not an expected AxTraxNG Access Report.',
          },
          {
            title: 'Read warnings and new doors',
            description:
              'New readers are listed with a suggested Entry / Exit / Neutral role. You can fix roles later on Doors.',
          },
          {
            title: 'Confirm the employee (PDF only)',
            description:
              'If it matched someone, you can still override. If not, pick from the list or enter a new name (required). CSV reports skip this step.',
          },
          {
            title: 'Commit import',
            description:
              'Disabled when the exact file is a duplicate, or when a PDF has no employee name. Success shows how many rows were new vs already present.',
          },
        ],
      },
    ],
    tips: [
      'A badge “Already imported” means this exact file was committed before — commit stays disabled to prevent duplicates.',
      'A CSV from later the same day is a new file: overlapping events are skipped, new badge reads are added. That is how continuous time tracking works.',
      'One PDF is typically one employee’s report. A CSV can contain the whole building.',
      'After importing, check Dashboard for hours and Doors if new readers appeared.',
      'Deleting a batch cannot be undone. Re-upload the file if you still need the data.',
    ],
    related: [
      { href: '/time-tracking/employees', label: 'Employees' },
      { href: '/time-tracking/doors', label: 'Classify doors' },
      { href: '/time-tracking/dashboard', label: 'Dashboard' },
    ],
  },

  '/time-tracking/employees': {
    title: 'Employees',
    tagline: 'Names, status and personal schedules',
    summary:
      'People are created automatically when you import a report. Here you search them, rename how they appear, deactivate leavers, and optionally override the global work schedule.',
    icon: 'users',
    canDo: [
      {
        icon: 'search',
        title: 'Search',
        description: 'Filter by display name or department. The list updates as you type.',
      },
      {
        icon: 'pencil',
        title: 'Edit an employee',
        description: 'Pencil icon opens display name, Active flag, and a schedule override.',
      },
      {
        icon: 'clock',
        title: 'Schedule override',
        description:
          'Set start, end, and working days for this person only. Leave fields empty to keep the global default from Configuration.',
      },
    ],
    howTo: [
      {
        title: 'Rename or set a custom schedule',
        steps: [
          {
            title: 'Find the person',
            description: 'Use search, then click the pencil on their row.',
          },
          {
            title: 'Display name vs canonical name',
            description:
              'Display name is what you see in reports. Canonical name is the original name from the access system — it is not editable here.',
          },
          {
            title: 'Active checkbox',
            description: 'Uncheck for people who left. They stay in history but are easier to skip in exports.',
          },
          {
            title: 'Optional schedule',
            description:
              'Only fill start/end/days if this person does not follow the company default. Save when done.',
          },
        ],
      },
    ],
    tips: [
      'Departments and aliases come from imported reports — they are informational here.',
      'You do not add employees on this page. Import a PDF or CSV (or type a new name during PDF import) to create one.',
      'Punctuality on the Dashboard uses this override when it is set, otherwise the global start time.',
    ],
    related: [
      { href: '/time-tracking/import', label: 'Import' },
      { href: '/time-tracking/config', label: 'Global schedule' },
    ],
  },

  '/time-tracking/anomalies': {
    title: 'Anomalies',
    tagline: 'Days that need a human look',
    summary:
      'Lists only days the engine flagged (missing badge, zero duration, overtime, and similar). You can apply a manual correction when the computed hours are wrong.',
    icon: 'warning',
    canDo: [
      {
        icon: 'calendar',
        title: 'Pick a date range',
        description: 'Same From / To control as the Dashboard. Only flagged days in that range are shown.',
      },
      {
        icon: 'flag',
        title: 'Read the flag legend',
        description: 'The card at the top explains every badge. Click a flag on a row to see the badge timeline.',
      },
      {
        icon: 'pencil',
        title: 'Manual correction',
        description:
          'Override worked minutes and lunch minutes. A reason of at least 3 characters is required (audit trail).',
      },
      {
        icon: 'trash',
        title: 'Clear an override',
        description: 'If a day already has a manual badge, you can remove the override and restore computed values.',
      },
    ],
    howTo: [
      {
        title: 'Fix a wrong day',
        steps: [
          {
            title: 'Open the flagged row',
            description: 'Click the pencil. The dialog shows the employee and date.',
          },
          {
            title: 'Enter worked and lunch minutes',
            description: 'Worked is 0–1440. Lunch is 0–240. These replace the computed values for that day.',
          },
          {
            title: 'Write why',
            description: 'Example: “Forgot to badge out”. Save stays disabled until the reason is long enough.',
          },
          {
            title: 'If it was a door problem instead',
            description:
              'Do not correct every similar row by hand. Fix the door role on Doors, then recompute.',
          },
        ],
      },
    ],
    tips: [
      'Missing exit / missing entry often mean a reader is classified wrong — check Doors → Door health.',
      'A “manual” badge means a person already overrode that day.',
      'Early start and overtime use the threshold from Configuration → Thresholds.',
      'Corrections are logged in the Audit log.',
    ],
    related: [
      { href: '/time-tracking/doors', label: 'Fix door roles' },
      { href: '/time-tracking/config', label: 'Thresholds' },
      { href: '/time-tracking/audit', label: 'Audit log' },
    ],
  },

  '/time-tracking/doors': {
    title: 'Doors',
    tagline: 'Doors, offices and reader roles',
    summary:
      'Imported readers are grouped into doors. Entry / Exit / Neutral is a tag on the reader, not the door name. Expand a row to see its readers. Admins can rename doors, set office and floor, and override reader roles.',
    icon: 'door',
    canDo: [
      {
        icon: 'search',
        title: 'Find a door',
        description: 'Search by name, office or floor, or filter with the Office and Floor dropdowns.',
      },
      {
        icon: 'eye',
        title: 'Expand a door',
        description: 'Open the row to see every reader on that door, its raw location, and its role.',
      },
      {
        icon: 'door',
        title: 'Set a reader role (admins)',
        description:
          'Entry starts a presence session. Exit closes it. Neutral is ignored (internal reader, no direction).',
      },
      {
        icon: 'pencil',
        title: 'Name, office and floor (admins)',
        description: 'Edit these on the door row. Readers stay attached to the door.',
      },
    ],
    howTo: [
      {
        title: 'Fix a misclassified reader',
        steps: [
          {
            title: 'Find the door',
            description: 'Search or filter, then expand the row to see its readers.',
          },
          {
            title: 'Change the reader role',
            description: 'Admins pick Entry, Exit or Neutral on the reader. It saves immediately.',
          },
          {
            title: 'Recompute the month',
            description:
              'Open Configuration → Recompute and run the range you care about, otherwise Dashboard and Anomalies still show the old pairing.',
          },
          {
            title: 'Recheck Anomalies',
            description: 'Missing entry/exit counts should drop if the role was the cause.',
          },
        ],
      },
    ],
    tips: [
      'Doors appear when you import a PDF or CSV — this page stays empty until the first import.',
      'Non-admins can browse doors and readers, but cannot change names or roles.',
      'Neutral is correct for readers that do not mean arriving or leaving the office.',
    ],
    related: [
      { href: '/time-tracking/anomalies', label: 'Anomalies' },
      { href: '/time-tracking/config', label: 'Recompute' },
      { href: '/time-tracking/import', label: 'Import' },
    ],
  },

  '/time-tracking/exports': {
    title: 'Exports',
    tagline: 'Download timesheets and save templates',
    summary:
      'Generate an Excel or CSV file for a date range, optionally for one employee. Templates remember columns and layout. If Mail is configured to send by default, a copy is also emailed.',
    icon: 'download',
    canDo: [
      {
        icon: 'calendar',
        title: 'Choose range and people',
        description: 'From / To, then All employees or a single person (inactive ones are labelled).',
      },
      {
        icon: 'file',
        title: 'Pick kind and format',
        description:
          'summary = one row per employee. pontaj = day matrix (classic timesheet). raw = source-style dump. File type is xlsx or csv.',
      },
      {
        icon: 'star',
        title: 'Use or skip a template',
        description: 'Templates override columns and titles. “None” uses the built-in default layout.',
      },
      {
        icon: 'download',
        title: 'Download export',
        description: 'Blocked while the app checks for data, and blocked if the interval is empty.',
      },
      {
        icon: 'plus',
        title: 'Manage templates',
        description: 'New template, Edit, or delete. Mark one as default per kind (star).',
      },
    ],
    howTo: [
      {
        title: 'Download this month’s timesheet',
        steps: [
          {
            title: 'Set the range',
            description: 'Defaults to the current month. Change From / To if you need another period.',
          },
          {
            title: 'Choose employee, kind, format',
            description: 'HR usually wants kind “pontaj” and format “xlsx” for the monthly grid.',
          },
          {
            title: 'Download',
            description:
              'If you see “No data in this interval”, import or widen the dates. The button stays disabled on purpose.',
          },
        ],
      },
      {
        title: 'Save a reusable template',
        steps: [
          {
            title: 'New template',
            description: 'Give it a name and a kind (summary, pontaj, or raw).',
          },
          {
            title: 'For summary: toggle columns',
            description: 'Click metrics on/off (worked hours, lunch, overtime, …). Optional sheet title and totals row.',
          },
          {
            title: 'For pontaj: pick the cell metric',
            description: 'Each day cell can show worked hours or worked minutes.',
          },
          {
            title: 'Save, then select it above',
            description: 'Check “Default for this kind” if this should be the usual layout.',
          },
        ],
      },
    ],
    tips: [
      'Download always happens in the browser. Email is extra, only when Mail → Report delivery is on.',
      'If email is enabled you will see “A copy will be emailed to …” under the button.',
      'Empty interval is not an error in the file — export is refused so you do not send a blank sheet.',
    ],
    related: [
      { href: '/time-tracking/dashboard', label: 'Dashboard' },
      { href: '/time-tracking/mail', label: 'Mail (admins)' },
    ],
  },

  '/time-tracking/audit': {
    title: 'Audit log',
    tagline: 'Who changed what, and when',
    summary:
      'A chronological list of actions in the portal (imports, corrections, config saves, user admin, and more). Regular users see only their own actions. Admins see everyone and can filter.',
    icon: 'file',
    canDo: [
      {
        icon: 'eye',
        title: 'Browse actions',
        description: 'Time, action type, entity, and optional before/after details. Latest first, up to 300 rows.',
      },
      {
        icon: 'filter',
        title: 'Filter by user (admins)',
        description: 'The dropdown at the top right limits the log to one account, or All users.',
      },
      {
        icon: 'file',
        title: 'View changes',
        description: 'Expand a row to see JSON before and after. Empty payloads are hidden.',
      },
    ],
    howTo: [
      {
        title: 'Investigate a correction',
        steps: [
          {
            title: 'Find the action',
            description: 'Look for the entity (for example a daily summary) and the timestamp.',
          },
          {
            title: 'Open View changes',
            description: 'Compare Before vs After to see worked minutes, lunch, or settings that moved.',
          },
          {
            title: 'Admins: narrow by user',
            description: 'Use the user filter if you already know who made the change.',
          },
        ],
      },
    ],
    tips: [
      'This page is read-only. You cannot undo from here — go back to the original screen (Anomalies, Doors, Users, …).',
      'Non-admins never see other people’s usernames or actions.',
    ],
    related: [
      { href: '/time-tracking/anomalies', label: 'Anomalies' },
      { href: '/time-tracking/users', label: 'Users (admins)' },
    ],
  },

  '/time-tracking/config': {
    title: 'Configuration',
    tagline: 'How hours, flags and calendars are calculated',
    summary:
      'Five tabs control the engine: default schedule and lunch, rounding/thresholds, public holidays, leaves, and a recompute tool. Changes do not rewrite old days until you recompute that range.',
    icon: 'settings',
    canDo: [
      {
        icon: 'clock',
        title: 'Schedule & lunch',
        description:
          'Global start/end and working days. Lunch window, cap in minutes, and whether the full cap is always deducted.',
      },
      {
        icon: 'settings',
        title: 'Thresholds',
        description:
          'Short-exit merge, daily rounding, early/overtime threshold, data retention, and optional special conditions.',
      },
      {
        icon: 'calendar',
        title: 'Holidays',
        description: 'Add or remove public holidays for the current year.',
      },
      {
        icon: 'user',
        title: 'Leaves',
        description:
          'Record vacation, sick, remote, or other for this month. Pick employee, date, type, optional note.',
      },
      {
        icon: 'refresh',
        title: 'Recompute',
        description: 'Re-run presence, worked hours and anomalies for a From–To range after you change settings.',
      },
    ],
    howTo: [
      {
        title: 'Change the company schedule',
        steps: [
          {
            title: 'Open Schedule & lunch',
            description: 'Set start, end, and click weekdays to include them. This is the default for everyone.',
          },
          {
            title: 'Tune lunch',
            description:
              'Window is when lunch is measured from time outside. Cap is the maximum lunch minutes counted. “Always deduct the full cap” forces that minimum even if they stayed inside.',
          },
          {
            title: 'Save schedule & lunch',
            description: 'Then open Recompute and run the months that should use the new rules.',
          },
        ],
      },
      {
        title: 'Add a special condition',
        steps: [
          {
            title: 'Open Thresholds',
            description: 'Use “Add condition” (minimum session, grace before/after, ignore zone, daily cap, extra rounding).',
          },
          {
            title: 'Fill the parameter',
            description: 'Minutes, or a comma-separated zone list for Ignore zone. Uncheck to disable without deleting.',
          },
          {
            title: 'Save thresholds & conditions',
            description: 'Recompute afterwards or Dashboard still shows the previous calculation.',
          },
        ],
      },
    ],
    tips: [
      'Per-employee schedules on the Employees page override this global schedule.',
      'Short-exit merge: brief outs shorter than N minutes are treated as still inside.',
      'The leaves table shows the current month. Choose a date in this month if you want the new row to appear immediately.',
      'Holidays are stored per calendar year shown in the tab title.',
    ],
    related: [
      { href: '/time-tracking/employees', label: 'Employee overrides' },
      { href: '/time-tracking/doors', label: 'Doors (also has Recompute)' },
      { href: '/time-tracking/dashboard', label: 'Dashboard' },
    ],
  },

  '/time-tracking/users': {
    title: 'Users',
    tagline: 'Portal accounts (admins only)',
    summary:
      'Create and manage who can sign in to TTAH. Changes are written to config/users.yml. This is not the Employees list — those are people in the access reports.',
    icon: 'key',
    canDo: [
      {
        icon: 'plus',
        title: 'Create a user',
        description:
          'First name, last name, an @orioninc.com email, username, role (user = HR, or admin), and an initial password. Creating the account sends a welcome email with those details and a sign-in button.',
      },
      {
        icon: 'pencil',
        title: 'Edit name and email',
        description: 'Used when the system sends messages to that person.',
      },
      {
        icon: 'key',
        title: 'Passwords',
        description:
          'Users reset their own password by email from the login page. Set initial assigns a new temporary password, emails it to them, and they must change it at next login.',
      },
      {
        icon: 'shield',
        title: 'Activate, deactivate, delete',
        description:
          'Deactivate blocks login. Delete removes them from users.yml. You cannot delete your own account.',
      },
    ],
    howTo: [
      {
        title: 'Onboard a colleague',
        steps: [
          {
            title: 'Fill Create user',
            description:
              'Email must be @orioninc.com. Initial password: 10+ characters, at least one letter and one digit.',
          },
          {
            title: 'Choose the role',
            description: 'user (HR) sees Time Tracking. admin also sees Users and Mail.',
          },
          {
            title: 'Share username + initial password',
            description:
              'They receive a welcome email with username, the temporary password, and a Sign in button. They must set a new password on first login. If Mail is not configured, share the password yourself.',
          },
        ],
      },
      {
        title: 'If someone cannot reset by email',
        steps: [
          {
            title: 'Confirm their mailbox',
            description: 'Forgot password emails the address saved on the user. Edit it if it is wrong or empty.',
          },
          {
            title: 'Set initial',
            description:
              'Type a new temporary password. We email it to them with a sign-in button. They must choose their own password after login.',
          },
          {
            title: 'If Mail is not configured',
            description: 'The password is still saved. Share it yourself, then they change it at next login.',
          },
        ],
      },
    ],
    tips: [
      'Employees (badge holders) and Users (login accounts) are different lists on purpose.',
      'Accounts with “must change” still have the initial password until they complete the change-password screen.',
      'Deactivate instead of delete if you might need the username back later.',
      'Forgot-password, welcome, and Set initial emails go out through Mail (Microsoft Graph). If Mail is not configured, users cannot self-reset and passwords must be shared by the admin.',
    ],
    related: [
      { href: '/time-tracking/mail', label: 'Mail' },
      { href: '/time-tracking/audit', label: 'Audit log' },
    ],
  },

  '/time-tracking/mail': {
    title: 'Mail',
    tagline: 'Send reports through Microsoft Graph (admins)',
    summary:
      'Configures how TTAH sends email — the same Graph app as Inventory. You set the visible sender name, who receives exported reports, who receives “Report a problem” emails, Azure credentials, then prove it with a test message.',
    icon: 'mail',
    canDo: [
      {
        icon: 'eye',
        title: 'Check status',
        description: 'Badges show whether config is complete and whether a client secret is stored.',
      },
      {
        icon: 'pencil',
        title: 'Sender appearance',
        description: 'From display name is what people see in Outlook next to the avatar — not the mailbox address.',
      },
      {
        icon: 'send',
        title: 'Report delivery',
        description:
          'When someone downloads an export, optionally email a copy to the report recipient(s). Download still always happens.',
      },
      {
        icon: 'warning',
        title: 'Problem reports',
        description:
          'Dev team address for the “Report a problem” button. Separate from HR export recipients. Users send a screenshot plus three short answers.',
      },
      {
        icon: 'shield',
        title: 'Graph configuration',
        description:
          'Collapsed by default. Authority, client ID, secret, scope, sender mailbox, from address. Verify token tests Azure.',
      },
      {
        icon: 'mail',
        title: 'Send test email',
        description:
          'To / CC / subject / body, wrapped in the same branded TTAH layout as other emails. Disabled until configuration is complete.',
      },
    ],
    howTo: [
      {
        title: 'Turn on emailed exports',
        steps: [
          {
            title: 'Save a report recipient',
            description: 'One address, or several separated by commas.',
          },
          {
            title: 'Enable “Email reports by default”',
            description: 'Then Save delivery. Exports will show a note that a copy will be sent.',
          },
          {
            title: 'Send a test first',
            description: 'Use Send test email to a mailbox you can open, so Graph is proven before real reports go out.',
          },
        ],
      },
      {
        title: 'Route problem reports to the dev team',
        steps: [
          {
            title: 'Save a problem-report recipient',
            description:
              'Under Problem reports, enter one or more addresses (comma-separated). This is not the HR export recipient.',
          },
          {
            title: 'Confirm Graph is configured',
            description:
              'The same mailbox that sends welcome and export emails also sends problem reports. Send a test first if you have not already.',
          },
        ],
      },
      {
        title: 'If sending fails',
        steps: [
          {
            title: 'Open Graph configuration',
            description: 'Confirm mailbox and from address. Paste a new client secret only if it rotated — leave blank to keep the current one.',
          },
          {
            title: 'Verify token',
            description: 'A success toast means Azure accepted the app. Failure is almost always credentials, scope, or tenant.',
          },
        ],
      },
    ],
    tips: [
      'Client secret is never shown again after save. Leave the field blank to keep the existing secret.',
      'From display name ≠ from address. Name is cosmetic; the mailbox must have Graph Mail.Send.',
      'Forgot-password, welcome, Set initial, export reports, problem reports, and test messages all use this Graph sender and the same branded layout. If Mail is not configured, those emails cannot go out.',
      'Problem report emails go only to the Problem reports recipients, never to the HR export address.',
      'This page is hidden from non-admin users.',
    ],
    related: [
      { href: '/time-tracking/exports', label: 'Exports' },
      { href: '/time-tracking/users', label: 'Users' },
    ],
  },
};

const PATH_ORDER = Object.keys(GUIDES).sort((a, b) => b.length - a.length);

export function getUserGuide(pathname: string): UserGuideContent | null {
  const exact = GUIDES[pathname];
  if (exact) return exact;
  const match = PATH_ORDER.find((path) => path !== '/' && pathname.startsWith(path));
  return match ? GUIDES[match] : null;
}
