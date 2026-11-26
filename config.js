// Datos públicos de conexión a Supabase.
// Esta clave "publishable" es segura de publicar: la seguridad real la dan
// las reglas (RLS) de la base de datos, que solo dejan ver a cada usuario sus pendientes.
window.PENDIENTES_CONFIG = {
  supabaseUrl: "https://bhjzrpabhackoonmabiu.supabase.co",
  supabaseKey: "sb_publishable_9I0yapy7bH6X_0iPZVbIrA_vhaBWN_c",
  // Clave pública para las notificaciones (Web Push). La privada vive solo en el Vault de Supabase.
  vapidPublicKey: "BA0ucF6zo1LPXwm5gdHcU8NQ5EsOJWCOWoqaNYTK3o82YsM_RnIZNP9zWbZVJr8TcObHFD5OyuwzACpz8iu4mqA",
};
