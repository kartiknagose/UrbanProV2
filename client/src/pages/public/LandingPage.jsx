// Landing Page — fully redesigned hero, animated sections, premium look

import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  Zap, Shield, Clock, Star, Users, Briefcase,
  ArrowRight, CheckCircle, Search, MapPin, Calendar,
  ChevronRight, Play, Award, HeartHandshake,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { MainLayout } from '../../components/layout/MainLayout';
import { IMAGES, getServiceImage } from '../../constants/images';
import { getPageLayout } from '../../constants/layout';
import { usePageTitle } from '../../hooks/usePageTitle';
import { LeaderboardSection } from './components/LeaderboardSection';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

export function LandingPage() {
  const { t } = useTranslation();
  usePageTitle();
  const navigate = useNavigate();
  const features = [
    {
      icon: Zap,
      title: t('Instant Booking'),
      description: t('Book verified professionals in under 60 seconds. Fast, easy, and reliable.'),
      gradient: 'from-yellow-400 to-orange-500',
      bg: 'from-yellow-50 to-orange-50 dark:from-yellow-500/10 dark:to-orange-500/10',
    },
    {
      icon: Shield,
      title: t('Verified Experts'),
      description: t('Every professional is vetted, background-checked, and skill-tested.'),
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10',
    },
    {
      icon: Clock,
      title: t('Flexible Schedule'),
      description: t('Choose time slots that work for you, 7 days a week.'),
      gradient: 'from-blue-400 to-brand-500',
      bg: 'from-blue-50 to-brand-50 dark:from-blue-500/10 dark:to-brand-500/10',
    },
    {
      icon: Award,
      title: t('Satisfaction Guaranteed'),
      description: t("Not happy? We'll re-do the job or give your money back."),
      gradient: 'from-violet-400 to-accent-500',
      bg: 'from-violet-50 to-accent-50 dark:from-violet-500/10 dark:to-accent-500/10',
    },
  ];

  const categories = [
    { name: t('Home Cleaning'), icon: '🧹' },
    { name: t('Plumbing'),      icon: '🚰' },
    { name: t('Electrical'),    icon: '⚡' },
    { name: t('Carpentry'),     icon: '🪚' },
    { name: t('Painting'),      icon: '🎨' },
    { name: t('AC Repair'),     icon: '❄️' },
    { name: t('Pest Control'),  icon: '🐜' },
    { name: t('Beauty'),        icon: '💅' },
  ];

  const stats = [
    { label: t('Active Workers'),       value: '500+',  icon: Users },
    { label: t('Services Completed'),   value: '10k+',  icon: CheckCircle },
    { label: t('Happy Customers'),      value: '5k+',   icon: HeartHandshake },
    { label: t('Average Rating'),       value: '4.8★',  icon: Star },
  ];

  return (
    <MainLayout>
      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center pt-16 overflow-hidden bg-white dark:bg-dark-950">

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <Motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.40, 0.25] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-10%] right-[-5%] w-[55%] h-[60%] rounded-full blur-[120px] bg-brand-400 dark:bg-brand-600"
          />
          <Motion.div
            animate={{ scale: [1, 1.10, 1], opacity: [0.15, 0.28, 0.15] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-[-15%] left-[-8%] w-[55%] h-[55%] rounded-full blur-[120px] bg-accent-400 dark:bg-accent-600"
          />
        </div>

        <div className={`${getPageLayout('wide')} relative z-10 w-full`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* ── Left: Headline ─────────────────────────────────────────── */}
            <Motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center lg:text-left"
            >
              {/* Pill badge */}
              <Motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                </span>
                <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                  {t('#1 Home Services in India')}
                </span>
              </Motion.div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 tracking-tight leading-[1.05] text-neutral-900 dark:text-white">
                {t('Expert hands for')}{' '}
                <br className="hidden sm:block" />
                <span className="gradient-text">{t('every home task')}</span>
              </h1>

              <p className="text-xl md:text-2xl mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t('The smartest way to book local professionals. Verified, insured, and ready to help you today.')}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="xl"
                  variant="gradient"
                  onClick={() => navigate('/services')}
                  icon={ArrowRight}
                  iconPosition="right"
                  className="h-14 px-8 text-lg"
                >
                  {t('Book a Service')}
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  onClick={() => navigate('/register?role=worker')}
                  className="h-14 px-8 text-lg"
                >
                  {t('Become a Pro')}
                </Button>
              </div>

              {/* Trust signals */}
              <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                {[
                  { icon: CheckCircle, text: 'Verified Pros',  color: 'text-success-500' },
                  { icon: Shield,      text: 'Insured Work',   color: 'text-accent-500' },
                  { icon: Star,        text: '4.9★ Rated',     color: 'text-yellow-500' },
                ].map(({ icon: I, text, color }) => (
                  <div key={text} className="flex items-center gap-2">
                    <I size={18} className={color} strokeWidth={2.5} />
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t(text)}</span>
                  </div>
                ))}
              </div>
            </Motion.div>

            {/* ── Right: Visual composition ──────────────────────────────── */}
            <Motion.div
              initial={{ opacity: 0, scale: 0.88, x: 48 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative hidden lg:block h-[520px]"
            >
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Left column */}
                <div className="space-y-4 pt-10">
                  {/* Booking card */}
                  <Motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="p-5 rounded-2xl border shadow-xl backdrop-blur-xl bg-white/95 border-neutral-100 dark:bg-dark-800/90 dark:border-dark-700"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-500/20 dark:to-brand-600/20 flex items-center justify-center">
                        <Briefcase size={18} className="text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-white text-sm">{t('Plumbing Fix')}</h4>
                        <p className="text-xs text-neutral-400">{t('Booked 2m ago')}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 bg-gradient-to-r from-brand-200 to-brand-300 dark:from-brand-600/40 dark:to-brand-500/40 rounded-full w-full" />
                      <div className="h-2 bg-neutral-100 dark:bg-dark-700 rounded-full w-2/3" />
                    </div>
                  </Motion.div>

                  {/* Rating card */}
                  <Motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="p-5 rounded-2xl border shadow-xl backdrop-blur-xl bg-white/95 border-neutral-100 dark:bg-dark-800/90 dark:border-dark-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-neutral-900 dark:text-white text-sm">{t('Top Rated')}</h4>
                      <span className="px-2.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
                        4.9 ⭐
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {[IMAGES.AVATAR_USER_1, IMAGES.AVATAR_USER_2].filter(Boolean).map((src, i) => (
                        <img key={i} src={src} className="w-8 h-8 rounded-full border-2 border-white dark:border-dark-800 object-cover bg-neutral-300" alt="user" />
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-dark-800 bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                        +5
                      </div>
                    </div>
                  </Motion.div>
                </div>

                {/* Right column — hero image */}
                <div className="space-y-4">
                  <Motion.div
                    animate={{ y: [0, -14, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="h-[310px] rounded-2xl relative overflow-hidden shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-600" />
                    {IMAGES.HERO_LANDING && (
                      <img src={IMAGES.HERO_LANDING} alt="Professional at work" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-70" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <div className="bg-white/15 backdrop-blur-xl p-3.5 rounded-xl border border-white/20">
                        <p className="text-xs font-semibold text-white/70 mb-0.5">{t('Worker of the Month')} 🏆</p>
                        <h3 className="text-lg font-black text-white">{t('Sarah Jenkins')}</h3>
                        <p className="text-white/80 text-xs font-medium">{t('Professional Cleaner')}</p>
                      </div>
                    </div>
                  </Motion.div>
                </div>
              </div>
            </Motion.div>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ════════════════════════════════════════════════════ */}
      <section className="py-10 border-y border-neutral-100 dark:border-dark-800 bg-white dark:bg-dark-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-neutral-100 dark:divide-dark-800">
            {stats.map((stat, i) => {
              const I = stat.icon;
              return (
                <Motion.div
                  key={stat.label}
                  {...fadeUp(i * 0.1)}
                  className="text-center px-4 first:pl-0 last:pr-0"
                >
                  <I size={20} className="mx-auto mb-2 text-brand-400" />
                  <div className="text-3xl md:text-4xl font-black mb-1 gradient-text">{stat.value}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{stat.label}</div>
                </Motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ═══════════════════════════════════════════════════════ */}
      <section className="section-padding bg-neutral-50 dark:bg-dark-900">
        <div className={getPageLayout('wide')}>
          <Motion.div {...fadeUp()} className="text-center mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-brand-500 mb-3 block">{t('Why UrbanPro')}</span>
            <h2 className="text-3xl md:text-5xl font-black mb-4 text-neutral-900 dark:text-white tracking-tight">
              {t('Why Millions Choose UrbanPro')}
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-neutral-500 dark:text-neutral-400">
              {t("We've reimagined the home service experience to be seamless, safe, and superior.")}
            </p>
          </Motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Motion.div
                  key={feature.title}
                  {...fadeUp(index * 0.12)}
                  className={`p-8 rounded-3xl bg-gradient-to-br ${feature.bg} border border-neutral-100 dark:border-dark-700 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg text-white group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={26} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-neutral-900 dark:text-white">{feature.title}</h3>
                  <p className="leading-relaxed text-neutral-600 dark:text-neutral-400 text-sm">{feature.description}</p>
                </Motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SERVICES GRID ══════════════════════════════════════════════════ */}
      <section className="section-padding bg-white dark:bg-dark-950 overflow-hidden">
        <div className={getPageLayout('wide')}>
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <Motion.div {...fadeUp()}>
              <span className="text-xs font-black uppercase tracking-widest text-brand-500 mb-2 block">{t('Services')}</span>
              <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">{t('Popular Services')}</h2>
              <p className="text-neutral-500 dark:text-neutral-400 mt-1">{t('Most booked services in your area this week')}</p>
            </Motion.div>
            <Button
              variant="outline"
              onClick={() => navigate('/services')}
              icon={ArrowRight}
              iconPosition="right"
              className="group"
            >
              {t('View All')}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {categories.map((category, index) => (
              <Motion.button
                key={category.name}
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.06, y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/services')}
                className="group relative flex flex-col items-center justify-end p-3 h-32 rounded-2xl border overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl border-neutral-100 dark:border-dark-700 hover:border-brand-300 dark:hover:border-brand-500/50"
              >
                {/* Background image */}
                <img
                  src={getServiceImage(category.name)}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-brand-900/80" />
                {/* Content */}
                <div className="relative z-10 text-center pb-1">
                  <span className="text-xl drop-shadow-md">{category.icon}</span>
                  <p className="text-[11px] font-bold text-white mt-0.5 leading-tight drop-shadow-md">{category.name}</p>
                </div>
              </Motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ══ LEADERBOARD ════════════════════════════════════════════════════ */}
      <LeaderboardSection />

      {/* ══ HOW IT WORKS ═══════════════════════════════════════════════════ */}
      <section className="section-padding bg-neutral-50 dark:bg-dark-900">
        <div className={getPageLayout('wide')}>
          <Motion.div {...fadeUp()} className="text-center mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-brand-500 mb-3 block">{t('Simple Process')}</span>
            <h2 className="text-3xl md:text-5xl font-black mb-4 text-neutral-900 dark:text-white tracking-tight">
              {t('Book in 3 easy steps')}
            </h2>
          </Motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-brand-300 via-accent-300 to-brand-300 opacity-40" />

            {[
              { step: '01', icon: Search,   title: t('Search a Service'),  desc: t('Browse hundreds of services and select what you need.') },
              { step: '02', icon: Calendar, title: t('Schedule a Slot'),   desc: t('Pick a date and time that works for your schedule.') },
              { step: '03', icon: CheckCircle, title: t('Get it Done'),   desc: t('A verified professional arrives and completes the job.') },
            ].map((item, i) => {
              const I = item.icon;
              return (
                <Motion.div key={item.step} {...fadeUp(i * 0.15)} className="text-center relative">
                  {/* Step number */}
                  <div className="relative inline-flex mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 dark:from-brand-500/15 dark:to-accent-500/15 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center">
                      <I size={32} className="text-brand-500 dark:text-brand-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white text-xs font-black flex items-center justify-center shadow-brand-sm">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">{item.title}</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                </Motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ CTA ════════════════════════════════════════════════════════════ */}
      <section className="section-padding bg-white dark:bg-dark-950">
        <div className={getPageLayout('narrow')}>
          <Motion.div
            {...fadeUp()}
            className="relative rounded-[2.5rem] p-12 lg:p-16 text-center overflow-hidden isolate"
            style={{ background: 'linear-gradient(135deg, #0f766e, #1d4ed8, #ea580c)' }}
          >
            {/* Background accents */}
            <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
              <div className="absolute top-0 left-1/4 w-80 h-80 bg-white/10 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent-500/20 rounded-full blur-[100px]" />
              {/* Noise texture overlay */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            </div>

            <span className="inline-block text-xs font-black uppercase tracking-widest text-white/60 mb-4">{t('Get Started Today')}</span>
            <h2 className="text-3xl md:text-5xl font-black mb-6 text-white tracking-tight leading-tight">
              {t('Ready to transform your home?')}
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of happy homeowners and expert professionals on the UrbanPro network.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="xl"
                onClick={() => navigate('/register')}
                className="h-14 px-8 text-lg font-bold bg-white text-brand-700 hover:bg-neutral-50 border-none shadow-2xl"
              >
                {t('Get Started')} · {t("It's Free")}
              </Button>
              <Button
                size="xl"
                variant="outline"
                onClick={() => navigate('/register?role=worker')}
                className="h-14 px-8 text-lg font-semibold border-white/30 text-white hover:bg-white/10"
              >
                {t('Join as a Pro')}
              </Button>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center justify-center gap-2 text-white/60 text-sm">
              <div className="flex -space-x-2">
                {[IMAGES.AVATAR_USER_1, IMAGES.AVATAR_USER_2, IMAGES.AVATAR_WORKER_1].filter(Boolean).map((src, i) => (
                  <img key={i} src={src} className="w-7 h-7 rounded-full border-2 border-white/30 object-cover bg-white/20" alt="" />
                ))}
              </div>
              <span>{t('Trusted by')} <strong className="text-white">50,000+</strong> {t('users')}</span>
            </div>
          </Motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
