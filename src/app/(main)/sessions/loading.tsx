import { CardGridSkeleton } from "@/components/skeletons";

export default function SessionsLoading() {
  return <CardGridSkeleton count={8} columns={1} list />;
}
