SET ROLE supabase_admin;
UPDATE thaco_master_channel_groups SET name = 'Nhận Diện', code = 'nhan_dien' WHERE name = 'NH\u1eacN DI\u1ec6N';
UPDATE thaco_master_channels SET name = 'Nhận diện' WHERE name = 'Nh\u1eadn di\u1ec7n';
UPDATE thaco_master_channel_groups SET name = 'Sự Kiện', code = 'su_kien' WHERE name = 'S\u1ef0 KI\u1ec6N';
UPDATE thaco_master_channels SET name = 'Sự kiện' WHERE name = 'S\u1ef1 ki\u1ec7n';
UPDATE thaco_master_channels SET name = 'Khác (Digital)' WHERE name = 'Kh\u00e1c (Digital)';
