SELECT rls_enabled FROM pg_tables WHERE tablename = 'thaco_master_channels';
SELECT rls_enabled FROM pg_tables WHERE tablename = 'thaco_master_channel_groups';
SELECT * FROM pg_policies WHERE tablename IN ('thaco_master_channels', 'thaco_master_channel_groups');
