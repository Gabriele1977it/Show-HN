import { Router, type IRouter } from "express";

import adminRouter from "./admin";
import advisoryRouter from "./advisory";
import authRouter from "./auth";
import awardwalletRouter from "./awardwallet";
import newsRouter from "./news";
import costOfLivingRouter from "./cost-of-living";
import disruptionsRouter from "./disruptions";
import companionRouter from "./companion";
import healthRouter from "./health";
import flightsRouter from "./flights";
import pushRouter from "./push";
import claimsRouter from "./claims";
import askRouter from "./ask";
import residencyRouter from "./residency";
import tripsRouter from "./trips";
import expensesRouter from "./expenses";
import airportRouter from "./airport";
import fxRouter from "./fx";
import journeyRouter from "./journey";
import loyaltyRouter from "./loyalty";
import publicRouter from "./public";
import referralRouter from "./referral";
import shootRouter from "./shoot";
import stripeRouter from "./stripe";

const router: IRouter = Router();

// Bare /api root — uptime monitors probing this path get 200 instead of 404.
router.get("/", (_req, res) => res.json({ ok: true }));

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(awardwalletRouter);
router.use(newsRouter);
router.use(advisoryRouter);
router.use(disruptionsRouter);
router.use(companionRouter);
router.use(flightsRouter);
router.use(pushRouter);
router.use(claimsRouter);
router.use(askRouter);
router.use(costOfLivingRouter);
router.use(residencyRouter);
router.use(tripsRouter);
router.use(expensesRouter);
router.use(airportRouter);
router.use(fxRouter);
router.use(journeyRouter);
router.use(loyaltyRouter);
router.use(publicRouter);
router.use(referralRouter);
router.use(shootRouter);
router.use(stripeRouter);

export default router;
