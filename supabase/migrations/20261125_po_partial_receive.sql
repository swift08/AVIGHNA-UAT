-- Partial PO receive: tag batches to PO + stock on received_quantity delta

ALTER TABLE public.product_batches
ADD COLUMN IF NOT EXISTS purchase_order_id TEXT REFERENCES public.purchase_orders(id);

CREATE INDEX IF NOT EXISTS product_batches_purchase_order_id_idx
  ON public.product_batches (purchase_order_id);

CREATE OR REPLACE FUNCTION public.trg_process_goods_received()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_received NUMERIC;
  v_delta NUMERIC;
  v_prev_on_hand NUMERIC;
  v_reserved NUMERIC;
BEGIN
  v_prev_received := COALESCE(OLD.received_quantity, 0);
  v_delta := COALESCE(NEW.received_quantity, 0) - v_prev_received;

  IF v_delta > 0 AND NEW.product_id IS NOT NULL THEN
    SELECT on_hand, reserved INTO v_prev_on_hand, v_reserved
    FROM public.products
    WHERE id = NEW.product_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.products
      SET on_hand = on_hand + v_delta,
          updated_at = NOW()
      WHERE id = NEW.product_id;

      INSERT INTO public.inventory_logs (
        company_id, product_id, transaction_type, quantity,
        previous_on_hand, new_on_hand, previous_reserved, new_reserved,
        reference_type, reference_id, notes, performed_by
      ) VALUES (
        NEW.company_id,
        NEW.product_id,
        'GOODS_RECEIVED',
        v_delta,
        v_prev_on_hand,
        v_prev_on_hand + v_delta,
        COALESCE(v_reserved, 0),
        COALESCE(v_reserved, 0),
        'purchase_order',
        NEW.id,
        'Goods received from PO ' || NEW.id || ' (+' || v_delta || ')',
        NEW.approved_by
      );
    END IF;
  END IF;

  IF COALESCE(NEW.received_quantity, 0) >= NEW.quantity THEN
    NEW.received_quantity := NEW.quantity;
    NEW.status := 'Received';
    NEW.received_at := COALESCE(NEW.received_at, NOW());
  ELSIF COALESCE(NEW.received_quantity, 0) > 0
        AND NEW.status = 'Received'
        AND OLD.status IS DISTINCT FROM 'Received' THEN
    -- Keep Partially-received POs in transit until fully received
    NEW.status := 'In transit';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_goods_received ON public.purchase_orders;
CREATE TRIGGER trg_po_goods_received
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_goods_received();
