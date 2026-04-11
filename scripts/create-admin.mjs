import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = 'admin@thaco.vn';
  const password = '1234';
  
  console.log(`Checking if user ${email} exists...`);
  
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }
  
  let user = usersData.users.find(u => u.email === email);
  
  if (!user) {
    console.log(`Creating user ${email}...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin' }
    });
    
    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    user = createData.user;
    console.log("User created:", user.id);
  } else {
    console.log("User already exists:", user.id);
    console.log("Updating password to 1234...");
    await supabase.auth.admin.updateUserById(user.id, { password });
  }

  // Check if user is in thaco_users table
  console.log("Checking thaco_users...");
  const { data: profile, error: profileError } = await supabase
    .from('thaco_users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!profile) {
     console.log("Inserting into thaco_users...");
     // FIND A VALID UNIT
     const { data: units } = await supabase.from('thaco_units').select('id').limit(1);
     let unitId = null;
     if (units && units.length > 0) {
        unitId = units[0].id;
     }

     const { error: insertError } = await supabase
       .from('thaco_users')
       .insert({
         id: user.id,
         email: email,
         full_name: 'Admin',
         role: 'super_admin',
         is_active: true,
         unit_id: unitId
       });

     if (insertError) {
        console.error("Error inserting thaco_user:", insertError);
     } else {
       console.log("Profile created successfully in thaco_users.");
     }
  } else {
        console.log("Profile exists. Updating role to super_admin...");
        await supabase.from('thaco_users').update({ role: 'super_admin' }).eq('id', user.id);
  }
}

run();
