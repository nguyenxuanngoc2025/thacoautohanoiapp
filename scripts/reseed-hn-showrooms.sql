-- Lấy unit_id của HN
DO $$
DECLARE
  v_unit_id uuid;
BEGIN
  SELECT id INTO v_unit_id FROM thaco_units WHERE code = 'HN' LIMIT 1;
  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'Unit HN not found';
  END IF;

  -- Xóa sạch showrooms cũ của chi nhánh HN
  DELETE FROM thaco_showrooms WHERE unit_id = v_unit_id;

  -- Insert lại 11 showrooms chuẩn
  INSERT INTO thaco_showrooms (unit_id, code, name, weight, brands, is_active) VALUES
  (v_unit_id, 'PVD', 'Phạm Văn Đồng', 0.15, '{}', true),
  (v_unit_id, 'DT', 'Đông Trù', 0.10, '{}', true),
  (v_unit_id, 'GP', 'Giải Phóng', 0.12, '{}', true),
  (v_unit_id, 'BD', 'Bạch Đằng', 0.10, '{}', true),
  (v_unit_id, 'NVC', 'Nguyễn Văn Cừ', 0.12, '{}', true),
  (v_unit_id, 'DAITU', 'Đài Tư', 0.08, '{}', true),
  (v_unit_id, 'BMWLB', 'BMW Long Biên', 0.06, '{}', true),
  (v_unit_id, 'LVL', 'Lê Văn Lương', 0.06, '{}', true),
  (v_unit_id, 'CM', 'Chương Mỹ', 0.05, '{}', true),
  (v_unit_id, 'HN', 'Hà Nam', 0.08, '{}', true),
  (v_unit_id, 'NB', 'Ninh Bình', 0.08, '{}', true);
END $$;
