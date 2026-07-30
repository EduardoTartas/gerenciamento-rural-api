-- Campo de perfil administrativo. Nenhum usuário nasce admin — precisa ser promovido
-- manualmente (UPDATE direto ou Prisma Studio). Não existe endpoint de auto-promoção.
ALTER TABLE "users" ADD COLUMN "admin" BOOLEAN NOT NULL DEFAULT false;
