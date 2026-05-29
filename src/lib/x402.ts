import { getChain } from "./config";

/**
 * x402 agentic payments.
 *
 * Implements the HTTP 402 "Payment Required" handshake: when an agent calls a
 * paid tool without payment, the gateway answers 402 with an `accepts` block
 * (scheme, amount, payTo, network, asset). The agent attaches an `x-payment`
 * header and retries; the gateway verifies + settles, then runs the tool and
 * returns an `x-payment-response` receipt.
 *
 * Pricing is trust-adjusted upstream (see dynamicPrice), so low-trust agents
 * pay more — bad actors subsidize their own risk. Settlement here is mocked
 * (no real chain calls) so the demo is self-contained, but the wire shape
 * matches the x402 spec and can be swapped for a real facilitator.
 */

const PAY_TO = process.env.X402_PAY_TO ?? "0x000000000000000000000000000000000000d3aD";
const ASSET = "USDC";

export interface X402Requirements {
  x402Version: number;
  accepts: {
    scheme: "exact";
    network: string;
    maxAmountRequired: string; // USD, as a decimal string
    resource: string;
    description: string;
    payTo: string;
    asset: string;
    maxTimeoutSeconds: number;
  }[];
}

export interface PaymentInfo {
  state: "required" | "settled";
  amount: number;
  network: string;
  asset: string;
  txHash?: string;
}

export function buildPaymentRequirements(tool: string, price: number): X402Requirements {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: getChain(),
        maxAmountRequired: price.toFixed(3),
        resource: `/api/x402/${tool}`,
        description: `Trust-priced access to ${tool}`,
        payTo: PAY_TO,
        asset: ASSET,
        maxTimeoutSeconds: 120,
      },
    ],
  };
}

/** Encode a demo payment authorization (what an agent's wallet would attach). */
export function encodePayment(amount: number, payer: string): string {
  const payload = {
    scheme: "exact",
    network: getChain(),
    amount,
    asset: ASSET,
    payer,
    ts: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export interface VerifyResult {
  ok: boolean;
  amount: number;
  txHash?: string;
  reason?: string;
}

/** Verify + settle an x-payment header against the required price. */
export function verifyAndSettle(header: string | null, required: number): VerifyResult {
  if (!header) return { ok: false, amount: 0, reason: "no payment provided" };
  let payload: { amount?: number; ts?: number };
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { ok: false, amount: 0, reason: "malformed x-payment header" };
  }
  const amount = Number(payload.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, amount: 0, reason: "invalid payment amount" };
  }
  if (payload.ts && Date.now() - payload.ts > 120_000) {
    return { ok: false, amount, reason: "payment authorization expired" };
  }
  if (amount + 1e-9 < required) {
    return { ok: false, amount, reason: `insufficient: authorized $${amount.toFixed(3)} < $${required.toFixed(3)}` };
  }
  // "Settle" the exact required amount and mint a receipt.
  const txHash = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return { ok: true, amount: required, txHash };
}

/** Build the x-payment-response receipt header value. */
export function settlementReceipt(info: { amount: number; txHash: string }): string {
  return Buffer.from(
    JSON.stringify({ success: true, txHash: info.txHash, amount: info.amount, network: getChain(), asset: ASSET }),
  ).toString("base64");
}

export const PAYMENT_NETWORK = () => getChain();
export const PAYMENT_ASSET = ASSET;
