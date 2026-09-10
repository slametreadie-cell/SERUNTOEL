# Supabase Setup for Seruntul Advanced

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - Name: `seruntul-advanced`
   - Database Password: (choose secure password)
   - Region: Choose nearest (Singapore for Indonesia)
4. Click "Create new project"

## 2. Get API Keys

After project creation:
1. Go to Project Settings > API
2. Copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Run Database Migrations

### Option A: Using SQL Editor (Recommended)
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL script

### Option B: Using Supabase CLI
```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## 4. Configure Authentication

1. Go to Authentication > Settings
2. Enable "Email" provider
3. Configure site URL: `http://localhost:3000` (development)
4. Configure redirect URLs

## 5. Create Storage Buckets

1. Go to Storage
2. Create buckets:
   - `product-photos` (for product images)
   - `documents` (for reports, documents)
3. Set appropriate policies

## 6. Test Connection

Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 7. Generate TypeScript Types

```bash
npm run supabase:gen
```

This will generate TypeScript types in `src/types/supabase.ts`

## Database Schema Overview

### Core Tables:
- `users` - User accounts with roles
- `products` - Product catalog with HPP
- `transactions` - POS transactions
- `inventory` - Stock management
- `customers` - Customer database
- `cashflow` - Financial records
- `suppliers` - Supplier information

### Configuration:
- `configuration` - App settings
- `margin_categories` - Profit margins by category

### Analytics:
- `daily_aggregates` - Daily sales summaries
- `profit_loss_reports` - Financial reports

## Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can only read their own data
- Role-based access control (owner, admin, user roles)
- Transaction data protected by business rules

## Backup & Maintenance

1. Enable daily backups in Supabase
2. Monitor database size and performance
3. Regular cleanup of old audit logs
