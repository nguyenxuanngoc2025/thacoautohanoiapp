-- Cho phép anon và authenticated đọc master channels và groups
-- Đây là master data không nhạy cảm, cần public read để hiển thị UI

-- Allow public read on thaco_master_channel_groups
DROP POLICY IF EXISTS "Master channel groups are publicly readable" ON thaco_master_channel_groups;
CREATE POLICY "Master channel groups are publicly readable"
  ON thaco_master_channel_groups FOR SELECT TO anon, authenticated USING (true);

-- Allow public read on thaco_master_channels  
DROP POLICY IF EXISTS "Master channels are publicly readable" ON thaco_master_channels;
CREATE POLICY "Master channels are publicly readable"
  ON thaco_master_channels FOR SELECT TO anon, authenticated USING (true);

-- Verify
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('thaco_master_channels', 'thaco_master_channel_groups')
ORDER BY tablename, cmd;
