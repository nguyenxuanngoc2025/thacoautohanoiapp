CREATE POLICY "Master channels readable"
  ON thaco_master_channels FOR SELECT TO anon, authenticated USING (true);
SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'thaco_master_channels';
