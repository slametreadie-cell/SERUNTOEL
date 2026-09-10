# Supabase SQL Migration Execution Guide

## Project: Seruntul Advanced
## URL: https://mjsetrszcgjohsewaevf.supabase.co

## Step 1: Login to Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Login with your account
3. Select project: "mjsetrszcgjohsewaevf"

## Step 2: Run SQL Migration
1. Click on "SQL Editor" in left sidebar
2. Click "New query"
3. Copy the SQL script below
4. Click "Run"

## Step 3: SQL Script to Run
Copy and paste the following SQL:

-- Migration: Seruntul Advanced Initial Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'produksi', 'kasir', 'user')),
  nama TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_produk TEXT NOT NULL,
  kategori TEXT,
  harga_jual DECIMAL(15,2) DEFAULT 0,
  stok_produk INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_transaksi TEXT UNIQUE NOT NULL,
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  total_bayar DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For the full schema with all tables, run the complete migration file.
