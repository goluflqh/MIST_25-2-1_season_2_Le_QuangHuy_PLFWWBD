import { Skeleton } from "@/components/ui/Skeleton";

export default function PricingLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-40 rounded-full" />
        <Skeleton className="mx-auto mb-4 h-12 w-full max-w-2xl" />
        <Skeleton className="mx-auto h-6 w-full max-w-xl" />
      </div>

      <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="p-6 pb-4">
              <Skeleton className="mb-3 h-7 w-44 rounded-full" />
            </div>
            <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-6">
              {[...Array(4)].map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
