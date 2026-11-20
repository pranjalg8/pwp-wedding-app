# Backup and restore

`.github/workflows/backup.yml` runs every night at 02:00 India time. It dumps the `public` and `auth` schemas, checks
the dump holds the main planner tables, encrypts it and keeps it as a workflow artifact for 30 days.

Files in the `documents` storage bucket are not in the dump. Keep the original vendor quotes elsewhere.

## Set it up (you do this once)

Never paste either value into a chat. Claude does not need to see them.

1. In Supabase, open **Connect** and copy the **Session pooler** connection string, with the database password filled
   in. GitHub's runners need the pooler because the direct address is IPv6 only.
2. In GitHub, open the repository's **Settings > Secrets and variables > Actions** and add:
   - `SUPABASE_DB_URL`: the connection string from step 1.
   - `BACKUP_PASSPHRASE`: a long passphrase. Save it in your password manager. A backup cannot be opened without it.
3. Open **Actions > Nightly database backup > Run workflow** and check that it finishes green.

## Restore

Practise this once on a new, empty Supabase project. Never restore over the live project without a fresh backup first.

1. Download the newest artifact from the workflow run and unzip it.
2. Decrypt it. `gpg` asks for the passphrase:

```bash
gpg --output planner.dump --decrypt planner-YYYY-MM-DD.dump.gpg
```

3. Restore the planner tables into the new project, using that project's connection string:

```bash
pg_restore --dbname "$TARGET_DB_URL" --no-owner --no-privileges --schema=public planner.dump
```

4. Compare the row counts of `guests`, `payments` and `payment_schedule` with the live project.
