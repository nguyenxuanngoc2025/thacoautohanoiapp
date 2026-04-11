const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://studio.ngocnguyenxuan.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMjUyMDAsImV4cCI6MTkyOTg5MTYwMH0.EswkDe7Zm8fNHw2pc08qoDYz5ahrk8koVHydLDQQSYU";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Check if user exists
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error.message);
    return;
  }
  
  let targetUser = users.users.find(u => u.email === 'nguyenxuanngoc@thaco.com.vn');
  
  if (!targetUser) {
    console.log("User not found! Creating...");
    const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: 'nguyenxuanngoc@thaco.com.vn',
      password: '1234', // Try 4 char
      email_confirm: true
    });
    if (createErr) {
       console.error("Create failed (might be 6 char minimum):", createErr.message);
       // Try with 123456
       const { data: d2, error: e2 } = await supabaseAdmin.auth.admin.createUser({
         email: 'nguyenxuanngoc@thaco.com.vn',
         password: '123456',
         email_confirm: true
       });
       if (e2) console.error("Create fallback failed:", e2.message);
       else console.log("Created successfully with 123456. User ID:", d2.user.id);
    } else {
       console.log("Created successfully with 1234. User ID:", data.user.id);
    }
  } else {
    // Force reset password to 123456
    console.log("User exists. ID:", targetUser.id);
    const { data, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: '123456'
    });
    if (updateErr) {
      console.log("Failed to update to 123456:", updateErr.message);
    } else {
      console.log("Forces updated password to 123456");
    }
  }
}

run();
