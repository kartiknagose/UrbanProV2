import { useQuery } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import { Star, Trophy, Award, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../../../api/workers';
import { Avatar, Button, Card } from '../../../components/common';
import { toFixedSafe } from '../../../utils/numberFormat';

const getSkillBadge = (completions) => {
  if (completions >= 100) return { label: "Master", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800", icon: Trophy };
  if (completions >= 50) return { label: "Top Rated", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: Award };
  if (completions >= 10) return { label: "Pro", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: ShieldCheck };
  if (completions >= 1) return { label: "Rising Star", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: Star };
  return null;
};

export function LeaderboardSection() {
  const navigate = useNavigate();
  const { data: topPros = [], isLoading } = useQuery({
    queryKey: ['leaderboard', 4],
    queryFn: () => getLeaderboard(4),
  });

  if (isLoading || topPros.length === 0) return null;

  return (
    <section className="py-24 bg-neutral-50 dark:bg-dark-900 relative overflow-hidden">
      {/* Decorative Background blur */}
      <div className="absolute top-0 right-0 -mr-48 -mt-48 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-48 -mb-48 w-96 h-96 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Motion.span 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest mb-4 border border-brand-200 dark:border-brand-500/30"
          >
            <Trophy size={14} className="text-brand-500" />
            Top Rating
          </Motion.span>
          <Motion.h2 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-neutral-900 dark:text-white mb-4 tracking-tight"
          >
            Meet Our <span className="gradient-text border-b-4 border-brand-500 rounded-sm">Top Pros</span>
          </Motion.h2>
          <Motion.p 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="text-lg text-neutral-600 dark:text-neutral-400"
          >
            The highest rated professionals who consistently deliver incredible service to our customers.
          </Motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topPros.map((pro, idx) => {
            const badge = getSkillBadge(pro.user?.totalReviews || 0);
            return (
              <Motion.div
                key={pro.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="h-full relative p-6 hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 border-neutral-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm group">
                  {/* Rank Badge */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center font-black text-lg shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                    #{idx + 1}
                  </div>

                  <div className="flex flex-col items-center text-center mt-2">
                    <Avatar 
                      src={pro.user?.profilePhotoUrl} 
                      name={pro.user?.name} 
                      size="xl" 
                      className="mb-4 ring-4 ring-brand-50 dark:ring-brand-500/10 shadow-lg" 
                    />
                    
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white mb-1">
                      {pro.user?.name}
                    </h3>

                    {/* Badge */}
                    {badge && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-md text-[10px] font-black uppercase tracking-widest ${badge.color}`}>
                        <badge.icon size={12} strokeWidth={3} />
                        {badge.label}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-6 bg-neutral-100 dark:bg-dark-800 px-4 py-1.5 rounded-full">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="fill-warning-500 text-warning-500" />
                        <span className="text-neutral-900 dark:text-white">{toFixedSafe(pro.user?.rating, 1, 'N/A')}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-neutral-300 dark:border-dark-600" />
                      <span>{pro.user?.totalReviews} Jobs</span>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full mt-auto rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-200 dark:hover:border-brand-500/30 transition-all group-hover:shadow-md"
                      onClick={() => pro.services?.[0]?.service?.id && navigate('/services/' + pro.services[0].service.id + '?worker=' + pro.id)}
                      disabled={!pro.services?.length}
                    >
                      {pro.services?.length ? 'Book Expert' : 'No Active Services'}
                    </Button>
                  </div>
                </Card>
              </Motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
