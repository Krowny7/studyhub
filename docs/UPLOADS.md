# Uploads (images)

## How it works

The UI lets authenticated users upload images.

Implementation:
- Upload component: `components/ImageInsertButton.tsx`
- Renderer: `components/RichContent.tsx`
- Storage: Supabase bucket **`media`**
- Text format: uploader inserts `[[img:PUBLIC_URL]]` on its own line.

This keeps the DB schema unchanged: images are just references in text.

## Supabase storage config

1. Create bucket `media`
   - Public bucket recommended (simplest)

2. Policies (for public bucket)
   - Allow authenticated users to `INSERT` objects
   - Allow `SELECT` for everyone (public read) **or** at least `authenticated`

If you prefer private images, you must switch the renderer to use **signed URLs**.

## Limits / cost control

Default max size in the UI: **4MB** (`ImageInsertButton` maxBytes).
You can lower it if you want.

Recommended hygiene:
- Store under `userId/yyyy-mm/uuid.ext`
- Consider lifecycle cleanup later (not implemented).
