# Admin Cache Revalidation

Brickhunt admins can manually revalidate public web cache from the admin panel:

`Admin -> Operations -> Cache Revalidation`

The browser calls the authenticated API route:

`POST /api/admin/cache/revalidate`

The API then forwards safe batches to the public web endpoint:

`POST ${WEB_BASE_URL}/api/revalidate`

The `WEB_REVALIDATE_SECRET` is only read by the API process and is never sent to
the browser.

## Security Model

- Admin authentication is required through either the existing Supabase bearer
  session or `x-admin-secret` for local/operator use.
- `x-admin-secret` is matched server-side against
  `ADMIN_CACHE_REVALIDATE_SECRET`, falling back to `ADMIN_PROMOTE_SECRET` while
  the dedicated cache secret is rolled out.
- The public web revalidation secret is injected server-side as
  `WEB_REVALIDATE_SECRET`.
- The target public web origin comes from `WEB_BASE_URL`.
- The API logs compact diagnostics and never logs the secret.
- Every attempt writes an audit row to `admin_operation_logs`.
- A small in-memory rate limit protects against accidental repeated requests.

Required API environment:

- `WEB_BASE_URL`
- `WEB_REVALIDATE_SECRET`
- `ADMIN_CACHE_REVALIDATE_SECRET` or `ADMIN_PROMOTE_SECRET` for local/operator
  curl access
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Limits

The public web endpoint accepts:

- max 25 paths per request
- max 100 tags per request

The admin API normalizes, dedupes, and batches sequentially. If one batch fails,
remaining batches continue and the response returns `partial_failure` with
warnings.

Paths must:

- start with `/`
- not contain a protocol or domain
- not contain whitespace

Tags are normalized through the shared cache tag rules.

Reason is required and must be 3-120 characters.

## Presets

The UI includes form-fill presets only. They do not perform hidden behavior.

- Homepage + Deals
- Single set page
- Theme page
- Promotions
- Recently updated sets

Review the prefilled paths/tags before submitting.

## Troubleshooting

`401 Admin authentication is required`
: Sign in to the admin app again, or use `x-admin-secret` for a local/operator
curl request.

`503 Public web revalidation is not configured`
: Check `WEB_BASE_URL` and `WEB_REVALIDATE_SECRET` on the API deployment.

`partial_failure`
: At least one public web batch returned a non-2xx response or timed out. Inspect
the returned batch status/body and retry only the failed paths/tags.

Missing audit rows
: Confirm the `admin_operation_logs` migration is applied and the API has
`SUPABASE_SERVICE_ROLE_KEY`.

Manual curl shape for diagnostics:

```bash
curl -X POST "$API_BASE_URL/api/admin/cache/revalidate" \
  -H "authorization: Bearer <admin-access-token>" \
  -H "content-type: application/json" \
  -d '{"paths":["/","/deals"],"tags":["homepage","deals"],"reason":"homepage_hotfix"}'
```

Local/operator curl without a Supabase browser session:

```bash
curl -X POST "$API_BASE_URL/api/admin/cache/revalidate" \
  -H "x-admin-secret: $ADMIN_CACHE_REVALIDATE_SECRET" \
  -H "content-type: application/json" \
  -d '{"paths":["/","/themes"],"tags":["homepage","themes"],"reason":"manual_theme_fix"}'
```

During rollout, `$ADMIN_PROMOTE_SECRET` is also accepted if
`ADMIN_CACHE_REVALIDATE_SECRET` is not configured.
