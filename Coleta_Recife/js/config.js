/* =====================================================================
   CONFIGURAÇÃO DO SUPABASE

   Onde achar (painel do Supabase):
   - SUPABASE_URL:  botão "Connect" do projeto  (ex.: https://abcdxyz.supabase.co)
   - SUPABASE_PUBLISHABLE_KEY:  Project Settings > API Keys
     Use a chave PUBLICÁVEL (começa com sb_publishable_...) ou, em projetos
     mais antigos, a chave "anon". Ela pode ficar no site, porque quem
     protege os dados são as regras (RLS) criadas em supabase/schema.sql.

   NUNCA coloque aqui a chave "secret" (sb_secret_...) nem a "service_role".
   ===================================================================== */

window.COLETA_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "COLE_AQUI_A_CHAVE_PUBLICAVEL"
};
