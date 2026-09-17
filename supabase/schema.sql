-- Data2Pro Database Schema for Supabase (PostgreSQL)

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Keywords Table
CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('video', 'vector', 'image')),
    search_url TEXT,
    result_count BIGINT,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for quick lookups by user and category
CREATE INDEX IF NOT EXISTS idx_keywords_user_category ON public.keywords(user_id, category);
CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON public.keywords(created_at DESC);

-- 3. Create Keyword Variants Table
CREATE TABLE IF NOT EXISTS public.keyword_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
    variant_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for variants by keyword_id
CREATE INDEX IF NOT EXISTS idx_keyword_variants_keyword_id ON public.keyword_variants(keyword_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_variants ENABLE ROW LEVEL SECURITY;

-- 5. Policies for 'keywords' Table
-- Users can view their own keywords
CREATE POLICY "Users can view their own keywords"
ON public.keywords
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own keywords
CREATE POLICY "Users can insert their own keywords"
ON public.keywords
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own keywords
CREATE POLICY "Users can update their own keywords"
ON public.keywords
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own keywords
CREATE POLICY "Users can delete their own keywords"
ON public.keywords
FOR DELETE
USING (auth.uid() = user_id);

-- 6. Policies for 'keyword_variants' Table
-- Users can view variants of their own keywords
CREATE POLICY "Users can view variants of their own keywords"
ON public.keyword_variants
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.keywords
        WHERE public.keywords.id = public.keyword_variants.keyword_id
        AND public.keywords.user_id = auth.uid()
    )
);

-- Users can insert variants for their own keywords
CREATE POLICY "Users can insert variants for their own keywords"
ON public.keyword_variants
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.keywords
        WHERE public.keywords.id = public.keyword_variants.keyword_id
        AND public.keywords.user_id = auth.uid()
    )
);

-- Users can delete variants for their own keywords
CREATE POLICY "Users can delete variants for their own keywords"
ON public.keyword_variants
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.keywords
        WHERE public.keywords.id = public.keyword_variants.keyword_id
        AND public.keywords.user_id = auth.uid()
    )
);
