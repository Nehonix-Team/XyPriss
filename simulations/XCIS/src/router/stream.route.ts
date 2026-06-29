///// SIMULATION JUSTE POUR DE RAISONS DE TESTS
import { Router } from "xypriss";
/**
 * Route pour gérer l'authentification des flux entrants
 */
const router = Router();

router.get(
  "/hell",
  {
    guards: {
      // roles: ["admin"],
      authenticated: true,
      testDeGuard: true,
      ipWhitelist: true,
    },
  },
  (req, res) => {
    res.send("Hi from 'hell'");
  },
);

export { router as streamRouter };
