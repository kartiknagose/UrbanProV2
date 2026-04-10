import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Video, ExternalLink, AlertTriangle } from 'lucide-react';

import { Card, Button } from '../../common';

function normalizeVideoUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  // Allow direct embeddable links or transform common YouTube links.
  if (url.includes('youtube.com/watch?v=')) {
    try {
      const parsed = new URL(url);
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    } catch (_err) {
      return '';
    }
  }

  if (url.includes('youtu.be/')) {
    try {
      const parsed = new URL(url);
      const id = parsed.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    } catch (_err) {
      return '';
    }
  }

  return url;
}

const CUSTOMER_POINTS = [
  'Share start OTP only after the professional arrives and identity is verified.',
  'Do not share OTP in chat or call before in-person verification.',
  'Keep communication in app chat and keep your phone reachable.',
  'Use SOS immediately if you feel unsafe at any point.',
  'Use Report if there is harassment, fraud, damage, or misconduct.',
];

const WORKER_POINTS = [
  'Start work only after customer provides the OTP in person.',
  'Upload clear before/after photos for transparent proof of service.',
  'Keep live location sharing on while service is in progress.',
  'Never request off-platform payments or personal account transfers.',
  'If unsafe, trigger SOS; for disputes or misconduct, file a report.',
];

export function SafetyGuidelinesCard({ role = 'CUSTOMER', className = '', compact = false }) {
  const { t } = useTranslation();
  const roleUpper = String(role || '').toUpperCase();
  const isWorker = roleUpper === 'WORKER';
  const checklist = isWorker ? WORKER_POINTS : CUSTOMER_POINTS;
  const title = isWorker ? t('Worker Safety Guidelines') : t('Customer Safety Guidelines');
  const videoUrl = normalizeVideoUrl(import.meta.env.VITE_SAFETY_GUIDELINES_VIDEO_URL);
  const safetyRoute = isWorker ? '/worker/safety/contacts' : '/customer/safety/contacts';

  return (
    <Card className={`p-4 border-none ring-1 ring-black/5 dark:ring-white/10 bg-white dark:bg-dark-900/40 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 flex items-center justify-center shrink-0">
          <ShieldCheck size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{t('Safety Briefing')}</p>
          <h4 className="text-sm font-black text-gray-900 dark:text-white">{title}</h4>
          <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
            {t('Please review these points before and during the service visit.')}
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          {videoUrl ? (
            <iframe
              src={videoUrl}
              title={t('Safety guidelines video')}
              className="w-full aspect-video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-dark-900/60">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <Video size={14} className="text-brand-500" />
                {t('Safety video not configured yet')}
              </div>
              <p className="text-[11px] mt-2 text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('Set VITE_SAFETY_GUIDELINES_VIDEO_URL in your frontend environment to show the training video here.')}
              </p>
            </div>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {checklist.map((point) => (
          <li key={point} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex gap-2">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
            <span>{t(point)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button as={Link} to={safetyRoute} size="sm" variant="outline" className="h-9 rounded-xl text-xs font-bold">
          {t('Emergency contacts')}
        </Button>
        <Button
          as={Link}
          to={safetyRoute}
          size="sm"
          variant="ghost"
          icon={ExternalLink}
          className="h-9 rounded-xl text-xs font-bold"
        >
          {t('Safety settings')}
        </Button>
      </div>

      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
          {t('For immediate danger use SOS. For non-emergency incidents use the Report option in this booking.')}
        </p>
      </div>
    </Card>
  );
}
