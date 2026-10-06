// Client Supabase partagé (null tant que config.js n'est pas rempli : le site reste alors en mode démo).
(function () {
  var cfg = window.BATIFLOW_CONFIG || {};
  var ok = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  window.bfClient = ok ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
})();
