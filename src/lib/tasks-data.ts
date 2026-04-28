import { createClient } from '@/lib/supabase/client';
import { type Task } from '@/lib/tasks-engine';

export async function fetchManualTasks(showroom?: string): Promise<Task[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('thaco_tasks')
    .select('*')
    .eq('type', 'manual')
    .or('status.eq.open,status.eq.completed')
    .order('created_at', { ascending: false });

  if (showroom) {
    query = query.eq('showroom', showroom);
  }

  try {
    const { data, error } = await query;
    if (error) {
      console.warn('Cannot fetch tasks (Maybe table thaco_tasks does not exist yet)', error.message);
      return [];
    }

    return (data || []).map((row: any): Task => ({
      id: row.id,
      type: 'manual',
      category: 'manual',
      priority: row.priority ?? 'this_month',
      title: row.title,
      description: row.description ?? '',
      deepLink: '',
      status: row.status,
    }));
  } catch (err) {
    return [];
  }
}

export async function completeManualTask(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('thaco_tasks')
    .update({ status: 'completed' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function createManualTask(data: {
  title: string;
  description: string;
  priority: string;
  showroom: string;
  dueDate: Date | null;
}) {
  const supabase = createClient();
  
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('thaco_tasks').insert({
    type: 'manual',
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: 'open',
    showroom: data.showroom,
    due_date: data.dueDate?.toISOString(),
    created_by: userData?.user?.id
  });

  if (error) {
    throw new Error(error.message);
  }
  
  return true;
}
