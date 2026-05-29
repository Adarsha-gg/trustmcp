"use client";

import { GatewayProvider } from "@/components/store";
import { Footer, Header, Hero, TierStrip } from "@/components/chrome";
import { Simulator } from "@/components/simulator";
import { ByoApi } from "@/components/byoapi";
import { Activity } from "@/components/activity";

export default function Page() {
  return (
    <GatewayProvider>
      <Header />
      <Hero />
      <TierStrip />
      <Simulator />
      <ByoApi />
      <Activity />
      <Footer />
    </GatewayProvider>
  );
}
