import { useState } from "react";
import { Search, CheckCircle2, Star, MessageSquare, User, ShieldCheck, Filter } from "lucide-react";
import { Input, Badge, Button, Avatar } from "../../../components/common";
import { bookingModes } from "./bookingModes";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { toFixedSafe } from "../../../utils/numberFormat";

const getVerificationLevelVariant = (level) => {
  switch (level) {
    case "VERIFIED": return "success";
    case "PREMIUM": return "warning";
    case "DOCUMENTS": return "info";
    default: return "neutral";
  }
};

const getSkillBadge = (completions) => {
  if (completions >= 100) return { label: "Master", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800" };
  if (completions >= 50) return { label: "Top Rated", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
  if (completions >= 10) return { label: "Pro", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" };
  if (completions >= 1) return { label: "Rising Star", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
  return null;
};

const VERIFICATION_FILTERS = [
  { id: "ALL", label: "All Pros", icon: null },
  { id: "PREMIUM", label: "Premium", icon: ShieldCheck },
  { id: "VERIFIED", label: "Verified", icon: CheckCircle2 },
  { id: "DOCUMENTS", label: "Docs Verified", icon: null },
  { id: "BASIC", label: "Basic", icon: null },
];

export function WorkerSelectionPanel({
  bookingMode,
  setBookingMode,
  workersLoading,
  filteredWorkers,
  selectedWorkerId,
  onQuickPick,
  onOpenWorkerProfile,
}) {
  const [verificationFilter, setVerificationFilter] = useState("ALL");

  const displayWorkers = filteredWorkers
    ? filteredWorkers.filter((worker) => verificationFilter === "ALL" || worker.verificationLevel === verificationFilter)
    : [];

  return (
    <div className="space-y-10">
      
      {/* Step 1: Booking Mode */}
      <section>
        <div className="mb-4">
          <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-black">1</div>
            Booking Preference
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 ml-11">How would you like us to assign your service professional?</p>
        </div>

        <div className="ml-11 p-1.5 rounded-2xl bg-neutral-100/50 dark:bg-dark-800/30 border border-neutral-200/50 dark:border-dark-700/50 flex flex-col sm:flex-row gap-1.5">
          {bookingModes.filter((m) => m.enabled).map((mode) => {
            const isActive = bookingMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setBookingMode(mode.id)}
                className={`relative flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 ${
                  isActive
                    ? "bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm border border-neutral-200/50 dark:border-dark-600"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-white/50 dark:text-neutral-400 dark:hover:bg-dark-700/50"
                }`}
              >
                <mode.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {mode.title}
                {isActive && mode.id === 'AUTO_ASSIGN' && (
                  <span className="absolute -top-2 -right-2 flex">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-success-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Worker Selection (Only if DIRECT mode is selected) */}
      <AnimatePresence mode="popLayout">
        {bookingMode === 'DIRECT' && (
          <Motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-black">2</div>
                Select Expert
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 ml-11">Choose a verified professional that matches your needs.</p>
            </div>

            <div className="ml-11">
              {/* Filters */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-dark-800 text-neutral-500 dark:text-neutral-400">
                  <Filter size={14} />
                  <span className="text-xs font-black uppercase tracking-widest">Filter</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {VERIFICATION_FILTERS.map((filter) => {
                    const isActive = verificationFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setVerificationFilter(filter.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                          isActive
                            ? "bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-500/30"
                            : "bg-white dark:bg-dark-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-dark-700 hover:border-brand-300 dark:hover:border-brand-700"
                        }`}
                      >
                       {filter.icon && <filter.icon size={12} strokeWidth={2.5} />}
                       {filter.label}
                       {isActive && verificationFilter !== "ALL" && (
                         <span className="ml-1 bg-brand-200 text-brand-800 dark:bg-brand-500/40 dark:text-brand-200 text-[9px] px-1.5 py-0.5 rounded-full">
                           {displayWorkers.length}
                         </span>
                       )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workersLoading ? (
                  [1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-44 rounded-2xl animate-pulse bg-neutral-100 dark:bg-dark-800" />
                  ))
                ) : displayWorkers.length > 0 ? (
                  displayWorkers.map((worker) => {
                    const isSelected = String(worker.id) === String(selectedWorkerId);
                    const verificationLevelLabel = worker.verificationLevel
                      ? `${String(worker.verificationLevel).charAt(0)}${String(worker.verificationLevel).slice(1).toLowerCase()}`
                      : '';

                    return (
                      <div
                        key={worker.id}
                        onClick={() => onQuickPick(worker.id)}
                        className={`relative cursor-pointer rounded-2xl p-5 transition-all duration-300 border ${
                          isSelected
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/5 shadow-brand-md transform scale-[1.02]"
                            : "border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-900 hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-500/50"
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className="relative shrink-0">
                            <Avatar src={worker.user?.profilePhotoUrl} name={worker.user?.name} size="lg" className="ring-2 ring-white dark:ring-dark-900 shadow-sm" />
                            {worker.verificationLevel && (
                              <div className="absolute -bottom-2 -right-2">
                                <Badge variant={getVerificationLevelVariant(worker.verificationLevel)} size="xs" className="shadow-sm border border-white dark:border-dark-900">
                                  <ShieldCheck size={10} strokeWidth={3} className="mr-0.5" />
                                  {verificationLevelLabel}
                                </Badge>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-neutral-900 dark:text-white truncate pr-2">
                                {worker.user?.name || "Professional"}
                              </h4>
                              <span className="font-black text-brand-600 dark:text-brand-400 shrink-0">
                                ₹{worker.hourlyRate}<span className="text-[10px] text-neutral-400 uppercase">/hr</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                              <div className="flex items-center gap-1 text-warning-500">
                                <Star size={12} className="fill-warning-400" />
                                <span>{toFixedSafe(worker.rating, 1, 'New')}</span>
                              </div>
                              <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-dark-700" />
                              <span>{worker.totalReviews} jobs</span>

                              {/* Skill Badge (Sprint 17 - #82) */}
                              {(() => {
                                const badge = getSkillBadge(worker.totalReviews || 0);
                                if (!badge) return null;
                                return (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-dark-700 hidden sm:block" />
                                    <span className={`hidden sm:inline-flex px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); onOpenWorkerProfile(worker.id); }}
                                className="h-9 px-0 text-[11px] font-bold"
                              >
                                View Profile
                              </Button>
                              <Button
                                size="sm"
                                variant={isSelected ? "primary" : "secondary"}
                                className={`h-9 px-0 text-[11px] font-black uppercase tracking-widest ${isSelected ? 'shadow-brand-sm' : ''}`}
                              >
                                {isSelected ? "Selected" : "Pick"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-1 md:col-span-2 text-center py-16 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-dark-700 bg-neutral-50/50 dark:bg-dark-800/20">
                    <Search className="mx-auto text-neutral-300 dark:text-dark-600 mb-4" size={48} />
                    <h4 className="font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      {verificationFilter !== "ALL" ? `No ${verificationFilter.toLowerCase()} workers found` : "No workers available"}
                    </h4>
                    <p className="text-sm text-neutral-500 mb-4">Try adjusting your filters or search criteria.</p>
                    {verificationFilter !== "ALL" && (
                      <Button size="sm" variant="outline" onClick={() => setVerificationFilter("ALL")}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}