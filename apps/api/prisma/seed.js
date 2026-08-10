"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function upsertSetting(key, value) {
    await prisma.setting.upsert({
        where: { key },
        create: { key, value: value },
        update: {},
    });
}
async function ensureTemplate(name, kind, layout, isDefault = false) {
    const existing = await prisma.exportTemplate.findFirst({ where: { name } });
    if (existing)
        return;
    await prisma.exportTemplate.create({
        data: { name, kind, layout: layout, isDefault },
    });
}
async function main() {
    await upsertSetting('schedule.global', {
        startTime: '08:00',
        endTime: '18:00',
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
    await ensureTemplate('Monthly summary', 'summary', {
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
    }, true);
    await ensureTemplate('Pontaj (hours)', 'pontaj', { title: 'Pontaj', includeTotals: true, matrixMetric: 'workedHours', columns: [] }, true);
    console.log('Seed complete.');
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map