# Protected material delivery

Campus and cluster accounts cannot SELECT originals in `koc-materials`, raster files in `koc-material-pages`, or page metadata. Both buckets remain private. Legacy materials remain unavailable to readers until prepared. Publishers may still inspect source files for preparation.

Publishers create material metadata, render PNG pages (maximum 1600×2400, 8 MiB each, 100 pages), upload `<auth.uid()>/<material.id>/page-<n>.png`, then call:

- `register_material_page(p_material_id, p_page_number, p_object_path, p_width, p_height)`: requires active admin/editor, matching uploader prefix, existing stored file, and unpublished active material. Exact retries are idempotent; conflicting registrations fail.
- `finalize_material(p_material_id, p_page_count)`: verifies every contiguous page has registration and storage object, then sets `protected_ready` and `page_count`. These columns cannot be written directly by authenticated clients. Published raster uploads cannot be replaced.

The authenticated edge handler calls `protected_material_page_access(p_material_id, p_page_number, p_session_id)` using the user's bearer token, never a service token. It returns one row: `session_id`, private `object_path`, `watermark_identity` (`full_name | account UUID`), `page_count`. The handler fetches the PNG using its server-only service credential and permanently composites repeated identity/time watermarks before returning bytes with `Cache-Control: no-store`. Never return a signed URL or original PDF to readers. Database access checks apply anew on every page, including after approval or scope revocation.

Sessions bind to account and material, expire after 15 minutes, and null session IDs reuse a current session. Requests serialize on the reader profile to enforce 60 page reads/minute and 20 new sessions/hour. Private tables record sessions and successful page accesses, and expose no client grants. Errors: `42501` access denied/expired session; `22023` invalid or unavailable page/preparation; `P0001` reader rate limit (edge should return HTTP 429).

Session/audit retention is an operator task: retain only as long as required, remove old audit rows before their sessions. These records are not exposed in the campus interface.

No browser mechanism can reliably prevent operating-system captures or photographing a screen. Protected page delivery removes straightforward PDF downloading, and server-composited watermarks retain attribution when client UI overlays are removed. The browser reader also applies focus and print concealment, but these are deterrents, not security boundaries.

`npm run test:database` creates and destroys a disposable local database. Tests cover original/raster isolation, publication completeness and immutability, forged sessions, publication authorization, watermark identity contract, and revoked account access. Live migrations must be applied separately after review.

## Deployment

Apply all checked-in migrations before publishing the frontend. Deploy the edge function with JWT verification enabled:

```sh
supabase functions deploy protected-material-page --project-ref yrqkafiqwllkphroztqk
```

Commit `index.ts`, `handler.ts`, `watermark.ts`, `deno.json` and `deno.lock` together. The edge runtime supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; never copy the service credential into frontend settings. The function permits the two production origins and localhost port 5173. Additional deployment origins need an explicit allow-list update. Check allowed-origin OPTIONS returns 204 and anonymous POST returns 401 after deployment.

Security-advisor notices for the private session/audit tables having no RLS policies are intentional: no client grants/policies means deny-all. Authenticated SECURITY DEFINER RPC access is also intentional; explicit active-profile, publisher and campus-scope checks enforce the operation before privileged table access. Source files and cached/signed copies already obtained before protection cannot be recalled. At rollout, the live source bucket was empty.
