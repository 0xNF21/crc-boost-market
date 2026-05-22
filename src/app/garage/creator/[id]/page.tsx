import type { Metadata } from "next";
import CreatorReputationPage from "@/components/creator-reputation-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator Reputation - CRC Boosts",
  description: "Public creator reputation profile for CRC Boosts by NF-Society.",
};

export default function GarageCreatorPage({ params }: { params: { id: string } }) {
  return <CreatorReputationPage creatorId={params.id} />;
}
