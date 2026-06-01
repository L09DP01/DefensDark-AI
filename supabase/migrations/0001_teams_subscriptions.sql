-- Create Teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Team Members table
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Create Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    payment_provider TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    moncash_transaction_ref TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A subscription must belong to a user OR a team, not both, not neither (unless we allow system wide things, but let's enforce one)
    CONSTRAINT check_user_or_team CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR 
        (user_id IS NULL AND team_id IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for Teams
CREATE POLICY "Users can view their own teams" 
ON public.teams FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid()
    )
);

-- Policies for Team Members
CREATE POLICY "Users can view members of their teams" 
ON public.team_members FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.team_members AS tm 
        WHERE tm.team_id = team_members.team_id 
        AND tm.user_id = auth.uid()
    )
);

-- Policies for Subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.subscriptions FOR SELECT 
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = subscriptions.team_id 
        AND team_members.user_id = auth.uid()
    )
);

-- Allow service role to do everything (bypasses RLS anyway, but good practice if needed)
-- Realistically, insertions for subscriptions/teams happen server-side with service_role key.
