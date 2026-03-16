-- Executar este script no SQL Editor do seu projeto Supabase

-- ============================================================
-- TABELA PRINCIPAL: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users on delete cascade,
    day text not null,
    period text not null,
    text text not null,
    completed boolean not null default false,
    color text not null default 'default',
    type text,
    priority text,
    is_habit boolean not null default false,
    parent_id uuid,
    position integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone,
    primary key (id)
);

-- Adicionar colunas opcionais caso a tabela já exista sem elas
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Ativar RLS para tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks"
    ON public.tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABELA: habits_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habits_history (
    user_id uuid not null references auth.users on delete cascade,
    habit_name text not null,
    date text not null,
    completed boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone,
    primary key (user_id, habit_name, date)
);

ALTER TABLE public.habits_history ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Ativar RLS para habits_history
ALTER TABLE public.habits_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own habits history"
    ON public.habits_history
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Criação da tabela de TIPOS de tarefas
CREATE TABLE IF NOT EXISTS public.task_types (
    id text not null,
    name text not null,
    color text not null,
    user_id uuid not null references auth.users on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (id, user_id)
);

-- Ativar RLS para task_types
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own task types"
    ON public.task_types
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Criação da tabela de PRIORIDADES de tarefas
CREATE TABLE IF NOT EXISTS public.task_priorities (
    id text not null,
    name text not null,
    color text not null,
    user_id uuid not null references auth.users on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (id, user_id)
);

-- Ativar RLS para task_priorities
ALTER TABLE public.task_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own task priorities"
    ON public.task_priorities
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Criação da tabela de CONFIGURAÇÕES do usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid not null references auth.users on delete cascade,
    enable_week_hover_animation boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id)
);

-- Ativar RLS para user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
    ON public.user_settings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Adicionar colunas de notificação push na user_settings
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS morning_notif_time time DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS evening_notif_time time DEFAULT '22:00',
    ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo';

-- ============================================================
-- TABELA: push_subscriptions
-- Armazena subscriptions do Web Push API por usuário/dispositivo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
