J'ai eu une bonne impression avec ce framework que vous avez créé et ça montre que l'équipe NEHONIX est vraiment ce qu'il est mais:

vous devrez supprimer ces logs de debuging au démarrage en mode multiserver: FiUp configuration initialized successfully
validation \_result: {
success: true,
errors: [],
warnings: [],
data: {
id: "nehopay.service",
port: "5278",

Vous devrez implementer des fonctionnalités de clustering lors des configs pour le mode multiserver.

ajoutez certaines fonctionnalités comme "requestManagement" etc... au multiserver.

Votre module "router.use" fonctionne pas, je fais "router.use(path, fn(req, res))" mais quand je fait req vers "path" j'obtient 404
