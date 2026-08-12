import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertSetting(key: string, value: unknown) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: {},
  });
}

async function ensureTemplate(
  name: string,
  kind: 'summary' | 'pontaj' | 'raw',
  layout: unknown,
  isDefault = false,
) {
  const existing = await prisma.exportTemplate.findFirst({ where: { name } });
  if (existing) return;
  await prisma.exportTemplate.create({
    data: { name, kind, layout: layout as never, isDefault },
  });
}

async function main() {
  // Default computation settings (idempotent — never overwrite HR changes).
  await upsertSetting('schedule.global', {
    startTime: '09:00',
    endTime: '17:30',
    workingDays: [1, 2, 3, 4, 5],
  });
  await upsertSetting('lunch', {
    windowStart: '12:00',
    windowEnd: '14:00',
    capMinutes: 30,
    forceMinimum: false,
  });
  await upsertSetting('thresholds', { shortExitMinutes: 10, roundingMinutes: 0 });
  await upsertSetting('retention.months', 24);

  // Starter export templates.
  await ensureTemplate(
    'Monthly summary',
    'summary',
    {
      title: 'Monthly summary',
      includeTotals: true,
      matrixMetric: 'workedHours',
      columns: [
        { key: 'employeeName', header: 'Employee' },
        { key: 'department', header: 'Department' },
        { key: 'daysPresent', header: 'Days' },
        { key: 'workedHours', header: 'Worked (h)' },
        { key: 'expectedHours', header: 'Expected (h)' },
        { key: 'overtimeHours', header: 'Overtime (h)' },
        { key: 'deficitHours', header: 'Deficit (h)' },
        { key: 'anomalies', header: 'Anomalies' },
      ],
    },
    true,
  );

  await ensureTemplate(
    'Pontaj (hours)',
    'pontaj',
    { title: 'Pontaj', includeTotals: true, matrixMetric: 'workedHours', columns: [] },
    true,
  );

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
