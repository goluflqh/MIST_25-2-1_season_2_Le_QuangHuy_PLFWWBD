import { TableSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white border border-slate-100 p-6 animate-pulse">
            <div className="h-4 w-24 bg-slate-100 rounded mb-4" />
            <div className="h-8 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
