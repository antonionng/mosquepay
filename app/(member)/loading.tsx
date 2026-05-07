import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function MemberLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      <SkeletonCard />
      <SkeletonCard />
      <span className="sr-only">Loading the member portal</span>
    </div>
  );
}
