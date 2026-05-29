import Stripe from "stripe";

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
const finalKey = stripeSecretKey === "" ? "dummy_key" : stripeSecretKey;

const stripe = new Stripe(finalKey, {
  apiVersion: "2026-04-22.dahlia",
});

export { stripe };
