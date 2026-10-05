/** Generate reviewed SQL; does not connect to or modify a database.
 * node scripts/import-campus-locations.mjs > /tmp/koc-campus-locations.sql
 * Review the file before applying it through the project's database tooling.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function locationSql(data) {
  const quote = value => `'${String(value).replaceAll("'", "''")}'`;
  const seen = new Set();
  const statements = data.locations.map(location => {
    if (!location.name || seen.has(location.name)) throw new Error('Campus names must be present and unique.');
    seen.add(location.name);
    if (!Number.isFinite(location.latitude) || location.latitude < 49 || location.latitude > 61 || !Number.isFinite(location.longitude) || location.longitude < -9 || location.longitude > 3) throw new Error(`Invalid UK reference coordinates for ${location.name}.`);
    if (!location.sourceUrl?.startsWith('https://www.openstreetmap.org/') || !location.address || !location.locationLabel) throw new Error(`Missing provenance for ${location.name}.`);
    // Fill unconfigured locations only. Existing independently verified locations remain untouched.
    const address = `${location.locationLabel}. ${location.address}. Source: ${location.sourceUrl}`;
    return `-- ${location.name}: ${location.sourceUrl}\nupdate public.campuses set latitude = ${location.latitude}, longitude = ${location.longitude}, address = ${quote(address)} where name = ${quote(location.name)} and latitude is null and longitude is null;`;
  });
  return `-- ${data.context}\n-- ${data.attribution}\n-- Research date: ${data.researchedAt}\n-- Existing pins and meeting information are preserved.\nbegin;\n${statements.join('\n')}\ncommit;\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(readFileSync(new URL('./campus-locations.json', import.meta.url), 'utf8'));
  process.stdout.write(locationSql(data));
}
