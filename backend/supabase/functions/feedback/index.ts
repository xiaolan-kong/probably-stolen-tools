import { createHandler } from './handler.mjs';
Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL'),
  key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  origins: (Deno.env.get('FEEDBACK_ALLOWED_ORIGINS') || '').split(',').map(x => x.trim()).filter(Boolean),
  adminIds: (Deno.env.get('FEEDBACK_ADMIN_IDS') || '').split(',').map(x => x.trim()).filter(Boolean),
}));
