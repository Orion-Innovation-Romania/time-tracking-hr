"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hhmmToMinutes = hhmmToMinutes;
exports.minutesToHhmm = minutesToHhmm;
exports.formatMinutes = formatMinutes;
exports.minutesToHours = minutesToHours;
exports.canonicalizeName = canonicalizeName;
exports.toDisplayName = toDisplayName;
function hhmmToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function minutesToHhmm(total) {
    const sign = total < 0 ? '-' : '';
    const m = Math.abs(Math.round(total));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function formatMinutes(total) {
    const sign = total < 0 ? '-' : '';
    const m = Math.abs(Math.round(total));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${sign}${h}:${String(mm).padStart(2, '0')}`;
}
function minutesToHours(min, digits = 2) {
    const f = 10 ** digits;
    return Math.round((min / 60) * f) / f;
}
function canonicalizeName(raw) {
    return raw
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
function toDisplayName(raw) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2) {
        const [surname, first] = parts;
        return `${titleCase(first)} ${titleCase(surname)}`;
    }
    return titleCase(raw.trim());
}
function titleCase(s) {
    return s
        .toLowerCase()
        .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase());
}
//# sourceMappingURL=utils.js.map