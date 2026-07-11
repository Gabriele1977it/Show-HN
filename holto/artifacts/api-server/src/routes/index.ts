import { Router, type IRouter } from "express";

import authRouter from "./auth";
import costOfLivingRouter from "./cost-of-living";
import disruptionsRouter from "./disruptions";
import companionRouter from "./companion";
import healthRouter from "./health";
import flightsRouter from "./flights";
import pushRouter from "./push";
import claimsRouter from "./claims";
import askRouter from "./ask";
import residencyRouter from "./residency";
import stripeRouter from "./stripe";

const router: IRouter = Router();

// Bare /api root — uptime monitors probing this path get 200 instead of 404.
router.get("/", (_req, res) => res.json({ ok: true }));

router.use(healthRouter);
router.use(authRouter);
router.use(disruptionsRouter);
router.use(companionRouter);
router.use(flightsRouter);
router.use(pushRouter);
router.use(claimsRouter);
router.use(askRouter);
router.use(costOfLivingRouter);
router.use(residencyRouter);
router.use(stripeRouter);

export default router;
