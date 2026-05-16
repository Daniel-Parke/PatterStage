import { CardGridSkeleton } from "@/components/skeletons";

export default function GatewayLoading() {
  return <CardGridSkeleton count={4} columns={2} />;
}