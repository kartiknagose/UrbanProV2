import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bell,
  Briefcase,
  Camera,
  CheckCircle2,
  MapPin,
  MessageSquare,
  PencilLine,
  Plus,
  Save,
  ShieldCheck,
  ShieldAlert,
  Star,
  UserCircle,
  Wallet,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../components/layout/MainLayout';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  WorkerTierBadge,
} from '../../components/common';
import { createWorkerProfile, getMyWorkerProfile } from '../../api/workers';
import { uploadProfilePhoto } from '../../api/uploads';
import { useAuth } from '../../hooks/useAuth';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { SocialShare } from '../../components/features/growth/SocialShare';
import { getPageLayout } from '../../constants/layout';
import { LocationPicker } from '../../components/features/location/LocationPicker';
import { MiniMap } from '../../components/features/location/MiniMap';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatCurrencyCompact } from '../../utils/formatters';
import { toastSuccess, toastError } from '../../utils/notifications';

const workerProfileSchema = z.object({
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  skills: z.string().min(2, 'Please add at least one skill'),
  serviceAreas: z.string().min(2, 'Please add at least one service area'),
  hourlyRate: z.coerce.number().min(1, 'Hourly rate must be greater than 0'),
  baseLatitude: z.number().optional(),
  baseLongitude: z.number().optional(),
  serviceRadius: z.number().min(1).max(100).optional(),
});

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 rounded-xl bg-neutral-100 p-2 text-neutral-600 dark:bg-dark-800 dark:text-neutral-300">
            <Icon size={16} />
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-neutral-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChipEditor({
  title,
  description,
  inputId,
  inputValue,
  onInputChange,
  onInputKeyDown,
  placeholder,
  chips,
  onRemove,
  emptyText,
  addAriaLabel,
  onAdd,
  hiddenInput,
  error,
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-900">
      <div className="mb-3">
        <label htmlFor={inputId} className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {title}
        </label>
        {description ? (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        ) : null}
      </div>

      <div className="mb-2.5 flex min-h-10 flex-wrap gap-1.5 rounded-xl bg-neutral-50 p-2 dark:bg-dark-800">
        {chips.length > 0 ? (
          chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-sm dark:bg-dark-700 dark:text-neutral-200"
            >
              {chip}
              <button type="button" onClick={() => onRemove(chip)} aria-label={`${title} ${chip}`}>
                <X size={12} className="text-neutral-400 hover:text-error-500" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-500">{emptyText}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          id={inputId}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" onClick={onAdd} className="px-3" aria-label={addAriaLabel}>
          <Plus size={16} />
        </Button>
      </div>

      {hiddenInput}
      {error && <p className="mt-2 text-xs font-semibold text-error-500">{error}</p>}
    </div>
  );
}

export function WorkerProfilePage() {
  const { t } = useTranslation();
  usePageTitle(t('Profile'));

  const navigate = useNavigate();
  const { user: authUser, setUser } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [skillsList, setSkillsList] = useState([]);
  const [serviceAreasList, setServiceAreasList] = useState([]);
  const [initialSkillsList, setInitialSkillsList] = useState([]);
  const [initialAreasList, setInitialAreasList] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [serverError, setServerError] = useState('');

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [initialPhotoUrl, setInitialPhotoUrl] = useState('');

  const [skillInput, setSkillInput] = useState('');
  const [areaInput, setAreaInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(workerProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      bio: '',
      skills: '',
      serviceAreas: '',
      hourlyRate: '',
      serviceRadius: 10,
      baseLatitude: undefined,
      baseLongitude: undefined,
    },
  });

  const watchedRate = useWatch({ control, name: 'hourlyRate' });
  const watchedRadius = useWatch({ control, name: 'serviceRadius' });

  const isVerified = Boolean(
    profileData?.isVerified ||
    profileData?.verificationStatus === 'APPROVED' ||
    profileData?.verificationStatus === 'VERIFIED'
  );

  const profileCompletion = useMemo(() => {
    const hasBio = Boolean((profileData?.bio || '').trim());
    const hasSkills = skillsList.length > 0;
    const hasAreas = serviceAreasList.length > 0;
    const hasRate = Boolean(profileData?.hourlyRate);
    const hasPhoto = Boolean(photoPreview);

    const items = [
      { key: 'bio', label: t('Bio'), done: hasBio },
      { key: 'skills', label: t('Skills'), done: hasSkills },
      { key: 'areas', label: t('Service areas'), done: hasAreas },
      { key: 'rate', label: t('Pricing'), done: hasRate },
      { key: 'photo', label: t('Profile photo'), done: hasPhoto },
    ];

    const completed = items.filter((item) => item.done).length;
    return {
      items,
      percent: Math.round((completed / items.length) * 100),
    };
  }, [profileData, skillsList, serviceAreasList, photoPreview, t]);

  const hasListChanges = useMemo(() => {
    const oldSkills = initialSkillsList.join('|').toLowerCase();
    const newSkills = skillsList.join('|').toLowerCase();
    const oldAreas = initialAreasList.join('|').toLowerCase();
    const newAreas = serviceAreasList.join('|').toLowerCase();
    return oldSkills !== newSkills || oldAreas !== newAreas;
  }, [initialSkillsList, skillsList, initialAreasList, serviceAreasList]);

  const hasPhotoChange = Boolean(photoFile) || (photoPreview && photoPreview !== initialPhotoUrl);
  const canSave = isEditing && (isDirty || hasListChanges || hasPhotoChange);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setServerError('');

      try {
        const data = await getMyWorkerProfile();
        const profile = data?.profile || null;
        const userData = profile?.user || authUser || null;

        if (!mounted) return;

        setProfileData(profile ? { ...profile, user: userData } : { user: userData });

        const normalizedSkills = normalizeList(profile?.skills);
        const normalizedAreas = normalizeList(profile?.serviceAreas);

        setSkillsList(normalizedSkills);
        setServiceAreasList(normalizedAreas);
        setInitialSkillsList(normalizedSkills);
        setInitialAreasList(normalizedAreas);

        reset({
          bio: profile?.bio || '',
          skills: normalizedSkills.join(', '),
          serviceAreas: normalizedAreas.join(', '),
          hourlyRate: profile?.hourlyRate || '',
          baseLatitude: profile?.baseLatitude || undefined,
          baseLongitude: profile?.baseLongitude || undefined,
          serviceRadius: profile?.serviceRadius || 10,
        });

        const resolvedPhoto = resolveProfilePhotoUrl(
          profile?.user?.profilePhotoUrl || authUser?.profilePhotoUrl || ''
        );
        setPhotoPreview(resolvedPhoto || '');
        setInitialPhotoUrl(resolvedPhoto || '');

        // Keep profile in view mode on load; user must explicitly click Edit.
        setIsEditing(false);
      } catch (error) {
        if (!mounted) return;
        setServerError(error?.response?.data?.message || t('Failed to load profile'));
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [authUser, reset, t]);

  const syncSkills = (next) => {
    setSkillsList(next);
    setValue('skills', next.join(', '), { shouldDirty: true });
  };

  const syncAreas = (next) => {
    setServiceAreasList(next);
    setValue('serviceAreas', next.join(', '), { shouldDirty: true });
  };

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value) return;
    if (skillsList.length >= 10) return;
    if (skillsList.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setSkillInput('');
      return;
    }
    syncSkills([...skillsList, value]);
    setSkillInput('');
  };

  const removeSkill = (value) => {
    syncSkills(skillsList.filter((item) => item !== value));
  };

  const addArea = () => {
    const value = areaInput.trim();
    if (!value) return;
    if (serviceAreasList.length >= 10) return;
    if (serviceAreasList.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setAreaInput('');
      return;
    }
    syncAreas([...serviceAreasList, value]);
    setAreaInput('');
  };

  const removeArea = (value) => {
    syncAreas(serviceAreasList.filter((item) => item !== value));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setServerError(t('Only image files are allowed'));
      return;
    }

    setServerError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setServerError('');
    setPhotoFile(null);
    setPhotoPreview(initialPhotoUrl || '');
    setSkillInput('');
    setAreaInput('');

    setSkillsList(initialSkillsList);
    setServiceAreasList(initialAreasList);

    reset({
      bio: profileData?.bio || '',
      skills: initialSkillsList.join(', '),
      serviceAreas: initialAreasList.join(', '),
      hourlyRate: profileData?.hourlyRate || '',
      baseLatitude: profileData?.baseLatitude || undefined,
      baseLongitude: profileData?.baseLongitude || undefined,
      serviceRadius: profileData?.serviceRadius || 10,
    });
  };

  const onSubmit = async (data) => {
    setServerError('');

    try {
      let profilePhotoUrl;
      if (photoFile) {
        const uploadResult = await uploadProfilePhoto(photoFile);
        profilePhotoUrl = uploadResult.url;
      }

      const payload = {
        bio: data.bio,
        hourlyRate: data.hourlyRate,
        skills: skillsList,
        serviceAreas: serviceAreasList,
        baseLatitude: Number.isFinite(data.baseLatitude) ? data.baseLatitude : undefined,
        baseLongitude: Number.isFinite(data.baseLongitude) ? data.baseLongitude : undefined,
        serviceRadius: data.serviceRadius,
      };

      // Backend currently validates profilePhotoUrl as local upload path only.
      // Upload endpoint already persists cloud URLs on user profile, so skip sending
      // external URLs here to avoid false validation failures during profile save.
      if (profilePhotoUrl && profilePhotoUrl.startsWith('/uploads/profile-photos/')) {
        payload.profilePhotoUrl = profilePhotoUrl;
      }

      await createWorkerProfile(payload);

      const refreshed = await getMyWorkerProfile();
      const refreshedProfile = refreshed?.profile || null;
      const mergedUser = refreshedProfile?.user || authUser || null;

      setProfileData(refreshedProfile ? { ...refreshedProfile, user: mergedUser } : { user: mergedUser });
      setInitialSkillsList(skillsList);
      setInitialAreasList(serviceAreasList);

      const resolvedPhoto = resolveProfilePhotoUrl(
        profilePhotoUrl || refreshedProfile?.user?.profilePhotoUrl || authUser?.profilePhotoUrl || ''
      );
      setPhotoPreview(resolvedPhoto || '');
      setInitialPhotoUrl(resolvedPhoto || '');
      setPhotoFile(null);
      setIsEditing(false);

      if (mergedUser) {
        const updatedUser = { ...authUser, ...mergedUser };
        if (profilePhotoUrl) updatedUser.profilePhotoUrl = profilePhotoUrl;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      toastSuccess(t('Profile updated successfully.'));
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        t('Failed to update profile');
      setServerError(errorMessage);
      toastError(errorMessage);
    }
  };

  const completionBadgeVariant = profileCompletion.percent >= 80 ? 'success' : 'info';
  const formattedHourlyRate = profileData?.hourlyRate
    ? formatCurrencyCompact(profileData.hourlyRate)
    : '--';

  return (
    <MainLayout>
      <div className={`${getPageLayout('default')} module-canvas module-canvas--profile`}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500">{t('Worker Profile')}</p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              {t('Manage Your Professional Profile')}
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              {t('Keep your profile updated so customers can trust and book you quickly.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isEditing && (
              <Button
                variant="secondary"
                size="sm"
                icon={PencilLine}
                onClick={() => setIsEditing(true)}
                className="h-10 rounded-xl px-4 font-bold text-xs"
              >
                {t('Edit Profile')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={ShieldCheck}
              onClick={() => navigate('/worker/verification')}
              className="h-10 rounded-xl px-4 font-bold text-xs"
            >
              {t('Verification')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Briefcase}
              onClick={() => navigate('/worker/services')}
              className="h-10 rounded-xl px-4 font-bold text-xs"
            >
              {t('Services')}
            </Button>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-3 py-2.5 text-sm font-semibold text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            {serverError}
          </div>
        )}

        {isLoadingProfile ? (
          <Card className="p-8">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('Loading profile...')}</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="space-y-6">
              <Card className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="h-24 w-24 overflow-hidden rounded-xl bg-neutral-100 dark:bg-dark-800">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-400">
                          <UserCircle size={44} />
                        </div>
                      )}
                    </div>
                    {isVerified && (
                      <div className="absolute -right-2 -bottom-2 rounded-lg bg-success-500 p-1.5 text-white shadow-lg">
                        <ShieldCheck size={14} />
                      </div>
                    )}
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-neutral-900 dark:text-white">
                    {profileData?.user?.name || t('Worker')}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {profileData?.user?.email || t('Email not available')}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <WorkerTierBadge totalJobs={profileData?.totalReviews || 0} />
                    <Badge variant={isVerified ? 'success' : 'info'}>
                      {isVerified ? t('Verified') : t('Verification Pending')}
                    </Badge>
                  </div>

                  <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-dark-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {t('Hourly Rate')}
                      </p>
                      <p className="mt-1 text-base font-bold text-neutral-900 dark:text-white">
                        {formattedHourlyRate}
                      </p>
                    </div>
                    <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-dark-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('Rating')}</p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <Star size={14} className="fill-warning-500 text-warning-500" />
                        <p className="text-base font-bold text-neutral-900 dark:text-white">
                          {profileData?.rating?.toFixed?.(1) || '4.9'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <CardHeader className="p-0">
                  <CardTitle>{t('Profile Completion')}</CardTitle>
                  <CardDescription>{t('Complete all essentials to improve visibility')}</CardDescription>
                </CardHeader>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500">{t('Progress')}</span>
                    <Badge variant={completionBadgeVariant}>{profileCompletion.percent}%</Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-dark-700">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${profileCompletion.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {profileCompletion.items.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={14} className={item.done ? 'text-success-500' : 'text-neutral-300'} />
                      <span className={item.done ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {!isEditing && (
                  <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3 dark:border-dark-700">
                    <Button variant="outline" fullWidth onClick={() => navigate('/worker/availability')} icon={MapPin}>
                      {t('Set Availability')}
                    </Button>
                    <Button variant="outline" fullWidth onClick={() => navigate('/worker/earnings')} icon={Wallet}>
                      {t('View Earnings')}
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => navigate('/worker/safety/contacts')}
                      icon={ShieldAlert}
                    >
                      {t('Emergency Contacts')}
                    </Button>
                    <Button variant="outline" fullWidth onClick={() => navigate('/messages')} icon={MessageSquare}>
                      {t('Messages')}
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => navigate('/notifications/preferences')}
                      icon={Bell}
                    >
                      {t('Notification Preferences')}
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <div>
              {!isEditing ? (
                <Card className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{t('Public Profile Preview')}</CardTitle>
                      <CardDescription className="mt-1">
                        {t('This is what customers see before booking you.')}
                      </CardDescription>
                    </div>
                    <SocialShare
                      title={t('Hire {{name}}', { name: profileData?.user?.name || t('Professional') })}
                      text={t('Check out my services on ExpertsHub V2.')}
                    />
                  </div>

                  <div className="space-y-5">
                    <section>
                      <h3 className="mb-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">{t('About')}</h3>
                      <p className="rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700 dark:bg-dark-800 dark:text-neutral-300">
                        {profileData?.bio || t('No bio provided yet.')}
                      </p>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">{t('Skills')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {skillsList.length > 0 ? (
                          skillsList.map((skill) => (
                            <Badge key={skill} variant="info">{skill}</Badge>
                          ))
                        ) : (
                          <p className="text-sm text-neutral-500">{t('No skills added yet.')}</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">{t('Service Areas')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {serviceAreasList.length > 0 ? (
                          serviceAreasList.map((area) => (
                            <Badge key={area}>{area}</Badge>
                          ))
                        ) : (
                          <p className="text-sm text-neutral-500">{t('No service areas defined yet.')}</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                        {t('Base Location & Service Radius')}
                      </h3>
                      {Number.isFinite(Number(profileData?.baseLatitude)) && Number.isFinite(Number(profileData?.baseLongitude)) ? (
                        <div className="rounded-lg border border-neutral-200 dark:border-dark-700">
                          <MiniMap
                            lat={Number(profileData.baseLatitude)}
                            lng={Number(profileData.baseLongitude)}
                            radius={profileData.serviceRadius || 10}
                            height="220px"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-dark-700 dark:text-neutral-400">
                          {t('Base location is not configured yet.')}
                        </div>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                        {t('Finance & Safety')}
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-dark-700 dark:bg-dark-800">
                          <div className="mb-2 flex items-center gap-2">
                            <Wallet size={14} className="text-brand-500" />
                            <p className="text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
                              {t('Finance')}
                            </p>
                          </div>
                          <p className="text-sm text-neutral-700 dark:text-neutral-200">
                            {t('Current base rate')}: <span className="font-bold">{formattedHourlyRate}</span>
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => navigate('/worker/earnings')}
                          >
                            {t('Open Earnings Dashboard')}
                          </Button>
                        </div>

                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-dark-700 dark:bg-dark-800">
                          <div className="mb-2 flex items-center gap-2">
                            <ShieldAlert size={14} className="text-brand-500" />
                            <p className="text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
                              {t('Safety')}
                            </p>
                          </div>
                          <p className="text-sm text-neutral-700 dark:text-neutral-200">
                            {t('Verification status')}: <span className="font-bold">{isVerified ? t('Verified') : t('Pending')}</span>
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => navigate('/worker/safety/contacts')}
                          >
                            {t('Manage Emergency Contacts')}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{t('Edit Profile')}</CardTitle>
                      <CardDescription className="mt-1">
                        {t('Update your details and save when you are ready.')}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        icon={X}
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                      >
                        {t('Cancel')}
                      </Button>
                      <Button
                        type="submit"
                        form="worker-profile-form"
                        icon={Save}
                        loading={isSubmitting}
                        disabled={isSubmitting || !canSave}
                      >
                        {t('Save Changes')}
                      </Button>
                    </div>
                  </div>

                  <form id="worker-profile-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 sm:space-y-5">
                    <SectionCard
                      title={t('Personal Info')}
                      description={t('Keep this section clear and professional for better customer trust.')}
                      icon={UserCircle}
                    >
                      <div className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-[160px_1fr]">
                          <div>
                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t('Profile Photo')}</p>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {t('Use a clear and professional image.')}
                            </p>
                          </div>

                          <label
                            htmlFor="worker-profile-photo"
                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-3 transition hover:bg-neutral-50 dark:border-dark-700 dark:hover:bg-dark-800"
                          >
                            <div className="h-16 w-16 overflow-hidden rounded-lg bg-neutral-100 dark:bg-dark-700">
                              {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                                  <UserCircle size={32} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {t('Upload Photo')}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {t('JPG or PNG, up to 10MB.')}
                              </p>
                            </div>
                            <Camera size={18} className="text-neutral-500" />
                            <input
                              id="worker-profile-photo"
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <Textarea
                          label={t('Professional Bio')}
                          rows={6}
                          placeholder={t('Describe your experience, services, and strengths.')}
                          error={errors.bio?.message}
                          {...register('bio')}
                        />
                      </div>
                    </SectionCard>

                    <SectionCard
                      title={t('Work Details')}
                      description={t('Set your pricing and service scope.')}
                      icon={Briefcase}
                    >
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-dark-700">
                          <Input
                            id="worker-hourly-rate"
                            label={t('Hourly Rate (INR)')}
                            type="number"
                            error={errors.hourlyRate?.message}
                            {...register('hourlyRate')}
                          />

                          <div>
                            <label
                              htmlFor="worker-hourly-rate-range"
                              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500"
                            >
                              {t('Quick Adjust')}
                            </label>
                            <input
                              id="worker-hourly-rate-range"
                              type="range"
                              min="100"
                              max="5000"
                              step="50"
                              value={watchedRate || 0}
                              onChange={(e) =>
                                setValue('hourlyRate', Number(e.target.value), { shouldDirty: true })
                              }
                              className="w-full accent-brand-500"
                            />
                            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                              {t('Current rate')}: <span className="font-bold">₹{watchedRate || 0}</span>
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-200 p-3 dark:border-dark-700">
                          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                              {t('Service Radius')}
                            </p>
                            <Badge>{(watchedRadius || 10)} {t('km radius')}</Badge>
                          </div>

                          <label htmlFor="worker-service-radius" className="sr-only">
                            {t('Service Radius')}
                          </label>
                          <input
                            id="worker-service-radius"
                            type="range"
                            min="1"
                            max="100"
                            {...register('serviceRadius', { valueAsNumber: true })}
                            className="w-full accent-brand-500"
                          />
                          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                            {t('Choose how far you are willing to travel for jobs.')}
                          </p>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard
                      title={t('Skills & Service Areas')}
                      description={t('Add the expertise and locations customers search for.')}
                      icon={CheckCircle2}
                    >
                      <div className="grid gap-4 lg:grid-cols-2">
                        <ChipEditor
                          title={t('Skills')}
                          description={t('Add up to 10 skills.')}
                          inputId="worker-skill-input"
                          inputValue={skillInput}
                          onInputChange={(e) => setSkillInput(e.target.value)}
                          onInputKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addSkill();
                            }
                          }}
                          placeholder={t('Add a skill')}
                          chips={skillsList}
                          onRemove={removeSkill}
                          emptyText={t('No skills added')}
                          addAriaLabel={t('Add skill')}
                          onAdd={addSkill}
                          hiddenInput={<input type="hidden" {...register('skills')} />}
                          error={errors.skills?.message}
                        />

                        <ChipEditor
                          title={t('Service Areas')}
                          description={t('Add up to 10 cities or localities.')}
                          inputId="worker-area-input"
                          inputValue={areaInput}
                          onInputChange={(e) => setAreaInput(e.target.value)}
                          onInputKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addArea();
                            }
                          }}
                          placeholder={t('Add city or locality')}
                          chips={serviceAreasList}
                          onRemove={removeArea}
                          emptyText={t('No service areas added')}
                          addAriaLabel={t('Add area')}
                          onAdd={addArea}
                          hiddenInput={<input type="hidden" {...register('serviceAreas')} />}
                          error={errors.serviceAreas?.message}
                        />
                      </div>
                    </SectionCard>

                    <SectionCard
                      title={t('Service Location')}
                      description={t('Set your base location to improve nearby job matching.')}
                      icon={MapPin}
                    >
                      <div className="rounded-xl border border-neutral-200 dark:border-dark-700">
                        <LocationPicker
                          className="!h-[260px] !rounded-xl"
                          radius={watchedRadius}
                          onChange={(loc) => {
                            setValue('baseLatitude', loc.lat, { shouldDirty: true });
                            setValue('baseLongitude', loc.lng, { shouldDirty: true });
                          }}
                          initialLocation={
                            Number.isFinite(Number(profileData?.baseLatitude)) && Number.isFinite(Number(profileData?.baseLongitude))
                              ? { lat: Number(profileData.baseLatitude), lng: Number(profileData.baseLongitude) }
                              : null
                          }
                        />
                      </div>
                    </SectionCard>

                    <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-3 sm:flex-row sm:justify-end dark:border-dark-700">
                      <Button type="button" variant="outline" icon={X} onClick={handleCancelEdit} disabled={isSubmitting}>
                        {t('Cancel')}
                      </Button>
                      <Button type="submit" icon={Save} loading={isSubmitting} disabled={isSubmitting || !canSave}>
                        {isSubmitting ? t('Saving...') : t('Save Changes')}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
