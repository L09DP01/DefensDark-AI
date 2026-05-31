import Stripe from "stripe";

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
const finalKey = stripeSecretKey === "" ? "dummy_key" : stripeSecretKey;

const stripe = new Stripe(finalKey, {
  apiVersion: "2026-05-27.dahlia",
});

export { stripe };
