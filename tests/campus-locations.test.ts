import { expect, test } from 'vitest';
import { locationSql } from '../scripts/import-campus-locations.mjs';
const base = { context: 'University reference points', attribution: 'OpenStreetMap', researchedAt: '2026-10-05' };
const pin = { name: "Test's University", latitude: 52, longitude: -1, address: "King's Road", sourceUrl: 'https://www.openstreetmap.org/way/1', locationLabel: 'KOC meeting location not confirmed' };
test('generates escaped updates that preserve existing pins and meeting information', () => {
 const sql = locationSql({ ...base, locations: [pin] });
 expect(sql).toContain("name = 'Test''s University'");
 expect(sql).toContain("King''s Road");
 expect(sql).toContain('and latitude is null and longitude is null');
 expect(sql).toContain('KOC meeting location not confirmed');
 expect(sql).not.toContain('meeting_info =');
 expect(sql).toContain('begin;');
 expect(sql).toContain('commit;');
});
test('rejects invalid coordinates, absent provenance and duplicate campuses', () => {
 expect(() => locationSql({ ...base, locations: [{ ...pin, latitude: 100 }] })).toThrow();
 expect(() => locationSql({ ...base, locations: [{ ...pin, sourceUrl: '' }] })).toThrow();
 expect(() => locationSql({ ...base, locations: [pin, pin] })).toThrow();
});
