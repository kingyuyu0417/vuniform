-- 客戶訪問記錄表（待命單）
CREATE TABLE IF NOT EXISTS public.guest_visits (
  id TEXT PRIMARY KEY,
  queue_no TEXT NOT NULL UNIQUE,
  guest_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  height_cm TEXT,
  weight_kg TEXT,
  phone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, assigned, fitting, selected, ready_for_pickup, completed
  school TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 取貨單表
CREATE TABLE IF NOT EXISTS public.pickup_tickets (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES public.guest_visits(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  queue_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_for_pickup', -- ready_for_pickup, picked_up, completed
  school TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 取貨單項目表
CREATE TABLE IF NOT EXISTS public.pickup_ticket_items (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES public.pickup_tickets(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_guest_visits_status ON public.guest_visits(status);
CREATE INDEX IF NOT EXISTS idx_guest_visits_created_at ON public.guest_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pickup_tickets_guest_id ON public.pickup_tickets(guest_id);
CREATE INDEX IF NOT EXISTS idx_pickup_tickets_status ON public.pickup_tickets(status);
CREATE INDEX IF NOT EXISTS idx_pickup_tickets_created_at ON public.pickup_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pickup_ticket_items_ticket_id ON public.pickup_ticket_items(ticket_id);
