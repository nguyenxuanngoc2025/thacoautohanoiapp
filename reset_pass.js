const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://studio.ngocnguyenxuan.com";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMjUyMDAsImV4cCI6MTkyOTg5MTYwMH0.EswkDe7Zm8fNHw2pc08qoDYz5ahrk8koVHydLDQQSYU";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const email = 'nguyenxuanngoc@thaco.com.vn';
  console.log(`Setting password to 123456 for ${email}...`);

  // Try creating first in case user doesn't exist
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: '12344321',
    email_confirm: true
  });

  if (createError) {
     console.log("Create user error (maybe exists?):", createError.message);
     // Let's get his user id from thaco_users table which bypasses Auth GoTrue!
     const { data: udata, error: uerror } = await supabaseAdmin.from('thaco_users').select('id, email').eq('email', email).single();
     if (uerror) {
       console.log("Error finding user in thaco_users:", uerror.message);
     } else {
       console.log("Found user ID in db:", udata.id);
       const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(udata.id, {
         password: '12344321',
       });
       if (resetErr) {
          console.error("Error resetting password:", resetErr.message);
       } else {
          console.log("SUCCESS! Password forcibly reset to 123456.");
       }
     }
  } else {
     console.log("SUCCESS! User created with password 123456.");
  }
}

run();
