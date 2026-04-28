SET ROLE supabase_admin;
UPDATE thaco_master_channel_groups SET name = 'Nhận Diện', code = 'nhan_dien' WHERE id = '2b182ddd-6122-40ba-b397-e7a9a2901b68';
UPDATE thaco_master_channels SET name = 'Nhận diện' WHERE id = 'cee78849-bd9b-418b-a6d8-ebf2412f356b';
UPDATE thaco_master_channel_groups SET name = 'Sự Kiện', code = 'su_kien' WHERE id = '32704dfa-8994-4888-a7bb-77034880245a';
UPDATE thaco_master_channels SET name = 'Sự kiện' WHERE id = '9b806556-d526-4762-84e1-a0abff2df477';
UPDATE thaco_master_channels SET name = 'Khác (Digital)' WHERE id = '7f3ad194-0ee1-4156-b593-4d7685f5d94f';
