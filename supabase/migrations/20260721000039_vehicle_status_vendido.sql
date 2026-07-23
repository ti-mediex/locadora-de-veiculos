-- Novo estado do veículo: "vendido". Veículos vendidos que ainda constam na base
-- de rastreamento do Ituran devem ter o rastreador retirado (alerta no módulo de
-- Rastreamento Ituran).
alter type public.vehicle_status add value if not exists 'vendido';
