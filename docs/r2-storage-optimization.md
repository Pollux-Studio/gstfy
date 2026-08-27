# R2 Storage Optimization

GSTfy uses Cloudflare R2 for tenant-owned media such as product photos and business logos.

## Current Rules

- Uploads use one R2 `PutObject` call per accepted file.
- The backend stores `objectKey`, `publicUrl`, content type, file name, and file size in Postgres.
- List, head, and get operations are not used by normal backend list/detail APIs.
- Product and POS screens render the stored public URL directly with browser/CDN caching.
- Invoice PDF generation uses a server-side logo data-URI cache so the same logo is not fetched from R2 on every invoice render.

## Operation Impact

| Flow | R2 Class A | R2 Class B |
|---|---:|---:|
| Upload product image | 1 | 0 |
| Upload business logo | 1 | 0 |
| Load product table | 0 | Browser image GETs only |
| Load product details | 0 | Browser image GETs only |
| Load POS grid | 0 | Browser image GETs only |
| Render invoice with logo | 0 | 1 per logo cache miss |

## Guardrails

- Product images are limited to 15 MB.
- Business logos are limited to 2 MB.
- Frontend validates MIME type and size before calling upload APIs.
- Upload API calls do not retry automatically, preventing duplicate Class A writes.
- R2 objects are written with immutable one-year cache headers.

## Future Optimization

- Generate small thumbnails for product tables and POS.
- Use a CDN/custom domain in front of R2 before large dealer rollout.
- Add image replacement cleanup jobs after object deletion support is introduced.
