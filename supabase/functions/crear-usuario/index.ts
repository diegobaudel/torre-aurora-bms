// Edge Function: crea usuarios desde la app (HU-02). Solo la puede usar un admin.
// Deploy: supabase functions deploy crear-usuario
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES = ['admin', 'operador', 'tecnico', 'recepcion', 'inquilino']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ¿Quién llama? Debe ser admin activo
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return json({ error: 'No autenticado' }, 401)
    const { data: perfil } = await admin.from('perfiles').select('rol, activo').eq('id', user.id).single()
    if (perfil?.rol !== 'admin' || !perfil.activo) return json({ error: 'Solo un administrador puede crear usuarios' }, 403)

    const { nombre, correo, password, rol } = await req.json()
    if (!nombre || !correo || !password) return json({ error: 'Faltan datos' }, 400)
    if (!ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)

    const { data, error } = await admin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    })
    if (error) {
      const msg = error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message
      return json({ error: msg }, 400)
    }
    return json({ id: data.user.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
