"use client";

import { GatewayProvider } from "@/components/store";
import { Footer, Header, Hero, TierStrip } from "@/components/chrome";
import { Simulator } from "@/components/simulator";
import { ByoApi } from "@/components/byoapi";
import { Activity } from "@/components/activity";
import { PassportPanel } from "@/components/passport";
import { GuardrailsPanel } from "@/components/guardrails-panel";
import { OpsPanel } from "@/components/ops";

export default function Page() {
  return (
    <GatewayProvider>
      <Header />
      <Hero />
      <TierStrip />
      <PassportPanel />
      <Simulator />
      <GuardrailsPanel />
      <ByoApi />
      <OpsPanel />
      <Activity />
      <Footer />
    </GatewayProvider>
  );
}
