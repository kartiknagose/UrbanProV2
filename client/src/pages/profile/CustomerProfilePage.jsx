import { useEffect, useState, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, MapPin, Save, ShieldCheck, UserCircle, 
  Camera, PencilLine, X, Navigation, Loader2, 
  Search, Map as MapIcon, Check, Settings, 
  Mail, Home, Lock, Bell, ChevronRight,
  MapPinOff, Map as MapIconLucide, Phone, Heart, Trash2, UserPlus, Siren,
  Info, Gift, Wallet, Award, Share2, Copy, AlertTriangle, ShieldAlert,
  History, MessageSquare, AlertCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Input, CardHeader, CardTitle, CardDescription, Button, Badge } from '../../components/common';
import { EmptyDataState } from '../../components/common/sections';
import { LocationPicker } from '../../components/features/location/LocationPicker';

import { getCustomerProfile, saveCustomerProfile } from '../../api/customers';
import { uploadProfilePhoto } from '../../api/uploads';
import { getEmergencyContacts, addEmergencyContact, deleteEmergencyContact } from '../../api/safety';
import { changePassword } from '../../api/auth';
import { getWallet, getLoyaltySummary, getReferralInfo } from '../../api/growth';
import { useAuth } from '../../hooks/useAuth';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { usePageTitle } from '../../hooks/usePageTitle';
import { queryKeys } from '../../utils/queryKeys';
import { formatCurrencyCompact } from '../../utils/formatters';
import { toastSuccess, toastError, toastInfo, toastErrorFromResponse, toastCopied } from '../../utils/notifications';

void motion;

export function CustomerProfilePage() {
  const { t } = useTranslation();
  usePageTitle(t('Profile Settings'));

  const [activeTab, setActiveTab] = useState('profile'); // profile, address, emergency, wallet, account
  const [addressSummary, setAddressSummary] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const formatWalletTransactionDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  // Growth & Rewards Data
  const { data: walletData } = useQuery({ queryKey: ['customer', 'wallet'], queryFn: getWallet, enabled: activeTab === 'wallet' });
  const { data: loyaltyData } = useQuery({ queryKey: ['customer', 'loyalty'], queryFn: getLoyaltySummary, enabled: activeTab === 'wallet' });
  const { data: referralData } = useQuery({ queryKey: ['customer', 'referrals'], queryFn: getReferralInfo, enabled: activeTab === 'account' });

  const [copiedRef, setCopiedRef] = useState(false);
  const handleCopyRef = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRef(true);
      toastCopied(t('Code copied!'));
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      toastError(t('Unable to copy code. Please copy it manually.'));
    }
  };

  // Emergency Contacts State
  const queryClient = useQueryClient();
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', relation: '' });

  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: queryKeys.safety.emergencyContacts(),
    queryFn: getEmergencyContacts,
    enabled: activeTab === 'emergency'
  });
  const contacts = contactsData?.contacts || [];

  const addContactMutation = useMutation({
    mutationFn: addEmergencyContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.safety.emergencyContacts() });
      setContactForm({ name: '', phone: '', relation: '' });
      setShowContactForm(false);
      toastSuccess(t('Emergency contact added!'));
    },
    onError: (error) => {
      toastErrorFromResponse(error, t('Failed to add contact'));
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: deleteEmergencyContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.safety.emergencyContacts() })
  });

  // Password Change State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toastSuccess(t('Password updated successfully!'));
      setShowPasswordForm(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => {
      toastErrorFromResponse(error, t('Failed to update password. Check your current password.'));
    }
  });

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toastError(t('New passwords do not match!'));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toastError(t('New password must be at least 8 characters.'));
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
  };

  const navigate = useNavigate();
  const { user: authUser, setUser } = useAuth();


  const customerProfileSchema = z.object({
    name: z.string().min(2, t('Name is required')),
    email: z.string().email(t('Invalid email address')),
    // Relaxed frontend validation to allow tab switching; backend enforces requirements
    line1: z.string().optional().or(z.literal('')),
    line2: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    postalCode: z.string().optional().or(z.literal('')),
    country: z.string().optional().or(z.literal('')),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(customerProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldUnregister: false, // CRITICAL: Keep data of hidden tabs preserved
    defaultValues: {
      name: '',
      email: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    }
  });

  // Watch all fields for real-time health calculation
  const allFormValues = useWatch({ control });

  // Calculate Profile Completion % Reactive to current form state
  const calculateStrength = () => {
    let score = 0;
    if (allFormValues.name?.length > 2) score += 20;
    if (authUser?.emailVerified) score += 20;
    if (authUser?.profilePhotoUrl || photoPreview) score += 20;
    if (allFormValues.line1 && allFormValues.city && allFormValues.postalCode) score += 20;
    if (contacts.length > 0) score += 20;
    return score;
  };
  const profileStrength = calculateStrength();

  // Watchers for live preview and logic
  const watchedEmail = useWatch({ control, name: 'email' });
  const watchedCity = useWatch({ control, name: 'city' });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getCustomerProfile();
        const address = data.user?.addresses?.[0];

        setAddressSummary(address || null);

        const formData = {
          name: data.user?.name || '',
          email: data.user?.email || '',
          line1: address?.line1 || '',
          line2: address?.line2 || '',
          city: address?.city || '',
          state: address?.state || '',
          postalCode: address?.postalCode || '',
          country: address?.country || 'India',
        };

        reset(formData);

        if (data.user?.profilePhotoUrl) {
          const resolvedPhoto = resolveProfilePhotoUrl(data.user.profilePhotoUrl);
          setPhotoPreview(resolvedPhoto);
        }
      } catch (error) {
        toastErrorFromResponse(error, t('Failed to load profile'));
      }
    };

    loadProfile();
  }, [reset, t]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toastError(t('Only image files are allowed'));
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleMapLocationChange = useCallback(async (loc) => {
    if (!loc) return;
    setSelectedLocation(loc);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${loc.lat}&lon=${loc.lng}`
      );
      const data = await response.json();

      if (data.address) {
        const addr = data.address;
        
        const line1 = [addr.house_number, addr.road, addr.neighbourhood, addr.residential].filter(Boolean).join(', ');
        const line2 = [addr.suburb, addr.city_district, addr.amenity, addr.village, addr.town].filter(Boolean).join(', ');
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.district || '';
        const state = addr.state || '';
        const postalCode = addr.postcode || '';

        const hasShegaon = (value) => String(value || '').toLowerCase().includes('shegaon');

        // Specific enhancement for Shegaon, Buldhana
        const isShegaon = 
          hasShegaon(addr.village) || 
          hasShegaon(addr.town) || 
          hasShegaon(addr.suburb) ||
          hasShegaon(addr.neighbourhood) ||
          hasShegaon(data.display_name);

        setValue('line1', line1 || addr.display_name?.split(',')[0] || '', { shouldDirty: true });
        setValue('line2', line2 || (isShegaon ? 'Shegaon (R), Shegaon' : ''), { shouldDirty: true });
        setValue('city', isShegaon ? 'Shegaon' : (city || ''), { shouldDirty: true });
        setValue('state', state || 'Maharashtra', { shouldDirty: true });
        setValue('postalCode', postalCode || '444203', { shouldDirty: true });
        setValue('country', 'India', { shouldDirty: true });
        
        toastInfo(t('Location parsed from map. Please review the fields below.'));
      }
    } catch (error) {
      console.error('Map Reverse Geocoding Error:', error);
      if (loc.address) {
        setValue('line1', loc.address, { shouldDirty: true });
      }
    }
  }, [setValue, t]);

  const onSubmit = async (data) => {
    try {
      let profilePhotoUrl;
      if (photoFile) {
        const uploadResult = await uploadProfilePhoto(photoFile);
        profilePhotoUrl = uploadResult.url;
      }

      const response = await saveCustomerProfile({
        ...data,
        profilePhotoUrl,
      });

      // Backend now returns { user }
      const updatedUserFromBackend = response.user;
      
      if (updatedUserFromBackend) {
        setAddressSummary(updatedUserFromBackend.addresses?.[0] || null);
        
        // Sync with Auth Context
        const newUserState = { ...authUser, ...updatedUserFromBackend };
        // Ensure local storage is also updated for persistence on refresh
        localStorage.setItem('user', JSON.stringify(newUserState));
        setUser(newUserState);
      }

      toastSuccess(t('Profile updated successfully!'));
      setIsEditing(false);
    } catch (error) {
      toastErrorFromResponse(error, t('Failed to update profile'));
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 module-canvas module-canvas--profile">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Sidebar Navigation */}
          <aside className="lg:w-80 flex-shrink-0">
            <div className="sticky top-24 space-y-8">
              <div className="px-2">
                <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none mb-2">
                  {t('Settings')}
                </h1>
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">{t('Personal Command Center')}</p>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'profile', label: t('Identity'), icon: UserCircle, desc: t('Name & Avatar') },
                  { id: 'address', label: t('Geospatial'), icon: Home, desc: t('Saved Places') },
                  { id: 'emergency', label: t('Safety'), icon: Siren, desc: t('Emergency Hub') },
                  { id: 'wallet', label: t('Finance'), icon: Wallet, desc: t('Wallet & Perks') },
                  { id: 'account', label: t('Security'), icon: Settings, desc: t('Access & Plus') },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                      w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                      ${activeTab === item.id 
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' 
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-dark-800 hover:text-neutral-900 dark:hover:text-neutral-200'}
                    `}
                  >
                    <div className={`p-2 rounded-lg transition-colors duration-300 ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-neutral-100 dark:bg-dark-700 text-neutral-600 dark:text-neutral-400 group-hover:text-brand-500'}`}>
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-bold text-sm tracking-tight leading-none mb-0.5">{item.label}</span>
                      <span className="text-xs font-medium opacity-60 uppercase tracking-wider">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <Card className="p-6 bg-gradient-to-br from-brand-500 to-brand-600 border-none text-white overflow-hidden relative group rounded-2xl shadow-md">
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-3">{t('Profile Completion')}</p>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="text-4xl font-black tracking-tight">{profileStrength}%</div>
                    <div className="h-2 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${profileStrength}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-white" 
                      />
                    </div>
                  </div>
                  <p className="text-xs font-semibold opacity-90 leading-relaxed uppercase tracking-wider">
                    {profileStrength < 100 
                      ? t('Complete your setup for priority support') 
                      : t('Profile fully verified!')}
                  </p>
                </div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              </Card>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {activeTab === 'profile' && (
                  <Card className="overflow-hidden border border-neutral-200 dark:border-dark-700">
                    <div className="px-6 py-5 border-b border-neutral-200 dark:border-dark-700 bg-neutral-50 dark:bg-dark-800/50 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{t('Personal Profile')}</h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('This information personalizes your experience.')}</p>
                      </div>
                      {!isEditing && (
                        <Button 
                          variant="outline" 
                          icon={PencilLine} 
                          onClick={() => setIsEditing(true)}
                          className="rounded-lg h-10"
                        >
                          {t('Edit')}
                        </Button>
                      )}
                    </div>

                    <div className="p-8">
                      <div className="flex flex-col lg:grid lg:grid-cols-[240px_1fr] gap-10">
                        {/* Avatar Lab */}
                        <div className="flex flex-col items-center">
                    <div className="relative group">
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                className="w-40 h-40 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-dark-800 border-4 border-neutral-200 dark:border-dark-700 relative z-10 shadow-md transition-all duration-300"
                            >
                              {photoPreview ? (
                                <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-dark-800/40">
                                  <UserCircle size={60} strokeWidth={1.5} />
                                  <span className="text-xs font-semibold uppercase tracking-wider mt-2 opacity-60">{t('No Photo')}</span>
                                </div>
                              )}
                            </motion.div>
                            
                            {isEditing && (
                              <label className="absolute -bottom-3 -right-3 z-20 w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer hover:bg-brand-600 hover:scale-110 active:scale-95 transition-all">
                                <Camera size={20} />
                                <input type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                              </label>
                            )}
                            
                            {/* Decorative background for avatar */}
                            <div className="absolute -inset-3 bg-gradient-to-tr from-brand-500/5 to-indigo-500/5 rounded-3xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                          </div>
                          
                          <div className="text-center mt-8 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{t('Profile Photo')}</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-dark-800 border border-neutral-200 dark:border-dark-700">
                                <div className={`w-1.5 h-1.5 rounded-full ${photoPreview ? 'bg-success-500' : 'bg-neutral-300'}`} />
                                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                                    {photoFile ? t('Uploading...') : (photoPreview ? t('Set') : t('Empty'))}
                                </span>
                            </div>
                          </div>
                        </div>

                        {/* Fields Column */}
                        <div className="flex-1 space-y-6">
                          <div className="flex flex-col gap-5">
                            <Input
                              label={t("Full Name")}
                              {...register('name')}
                              readOnly={!isEditing}
                              icon={UserCircle}
                              error={errors.name?.message}
                              className={!isEditing ? 'bg-neutral-50 dark:bg-dark-800/50 border-neutral-200 dark:border-dark-700' : ''}
                            />
                            
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 ml-1">
                                {t('Registered Email')}
                              </label>
                              <div className="h-12 px-3 rounded-lg bg-neutral-100 dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Mail size={16} className="text-neutral-400" />
                                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                                    {watchedEmail}
                                  </span>
                                </div>
                                <Lock size={13} className="text-neutral-400" />
                              </div>
                              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 ml-1">
                                {t('Email cannot be changed after registration.')}
                              </p>
                            </div>
                          </div>

                          {isEditing && Object.keys(errors).length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 rounded-lg bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 text-error-700 dark:text-error-300 text-xs font-semibold flex flex-col gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={14} />
                                {t('Please fix errors before saving.')}
                              </div>
                              <ul className="list-disc list-inside pl-2 opacity-80 text-xs">
                                {Object.keys(errors).map(key => (
                                  <li key={key}>{errors[key]?.message}</li>
                                ))}
                              </ul>
                            </motion.div>
                          )}

                          <AnimatePresence>
                            {isEditing && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="pt-4 flex gap-3"
                              >
                                <Button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSubmit(onSubmit, (errs) => {
                                      console.error('Submission Errors:', errs);
                                      const firstError = Object.values(errs)[0]?.message;
                                      toastError(firstError || t('Please review your profile details.'));
                                    })();
                                  }}
                                  loading={isSubmitting}
                                  icon={Check}
                                  className="rounded-lg h-11"
                                >
                                  {t('Save Changes')}
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => { setIsEditing(false); reset(); }}
                                  icon={X}
                                  className="rounded-lg h-11"
                                >
                                  {t('Cancel')}
                                </Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {activeTab === 'address' && (
                  <div className="space-y-6">
                    <Card className="p-10 border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-sm overflow-hidden relative rounded-[3rem]">
                      <div className="absolute top-0 right-0 p-12 opacity-5">
                        <MapPin size={240} className="text-brand-500 -rotate-12 translate-x-16 -translate-y-16" />
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                        <div>
                          <h2 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none mb-3">{t('Geospatial Hub')}</h2>
                          <div className="flex items-center gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                             <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                               {t('High-precision location tracking active.')}
                             </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {!isEditing && (
                            <Button 
                              variant="glass" 
                              icon={PencilLine} 
                              onClick={() => {
                                setIsEditing(true);
                                setActiveTab('address');
                              }}
                              className="rounded-2xl px-6 h-12 font-black text-[10px] uppercase tracking-widest border-white/10"
                            >
                              {t('Sync Location')}
                            </Button>
                          )}
                          <div className="px-6 py-3 rounded-2xl bg-neutral-100 dark:bg-dark-800 border border-neutral-200 dark:border-dark-700">
                            <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] block mb-1">{t('Active Node')}</span>
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{watchedCity || t('Undefined')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-10 relative z-10">
                        {/* Integrated Map Interface - Full Width Integration */}
                        <div className="relative group rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl transition-all hover:border-brand-500/30">
                          <LocationPicker 
                            className="!h-[400px] !rounded-none"
                            onChange={handleMapLocationChange}
                            initialLocation={selectedLocation || (addressSummary ? { lat: addressSummary.lat, lng: addressSummary.lng } : null)}
                          />
                          
                          {/* Map Overlay HUD - Hidden to avoid overlap */}
                        </div>

                        {/* Structured Fields */}
                        <div className="p-8 bg-neutral-50 dark:bg-dark-800/40 rounded-[2rem] border border-neutral-200 dark:border-dark-700/50 space-y-8">
                          <div className="space-y-6">
                            <Input
                              label={t("Street Address (Line 1)")}
                              placeholder={t("e.g. Near Gajanan Maharaj Temple")}
                              {...register('line1')}
                              readOnly={!isEditing}
                              icon={MapPin}
                              error={errors.line1?.message}
                              className="h-14"
                              inputClassName={!isEditing ? 'cursor-not-allowed opacity-70' : ''}
                            />
                            <Input
                              label={t("Area / Landmark (Line 2)")}
                              placeholder={t("e.g. Ward No. 5, Main Road")}
                              {...register('line2')}
                              readOnly={!isEditing}
                              icon={Navigation}
                              className="h-14"
                            />
                          </div>
                          
                          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <Input label={t("City")} {...register('city')} readOnly={!isEditing} icon={MapIconLucide} error={errors.city?.message} className="h-14" />
                            <Input label={t("State")} {...register('state')} readOnly={!isEditing} icon={ShieldCheck} error={errors.state?.message} className="h-14" />
                            <Input label={t("PIN Code")} {...register('postalCode')} readOnly={!isEditing} icon={MapPin} error={errors.postalCode?.message} className="h-14" />
                          </div>

                          <div className="flex items-center gap-6 pt-4 border-t border-neutral-200 dark:border-dark-700">
                            {isEditing ? (
                              <>
                                <Button 
                                  onClick={() => {
                                    handleSubmit(onSubmit, (errs) => {
                                      console.error('Global Submission Errors:', errs);
                                      const firstError = Object.values(errs)[0]?.message;
                                      toastError(firstError || t('Please review required inputs.'));
                                    })();
                                  }} 
                                  icon={Save} 
                                  className="h-14 px-10 rounded-xl"
                                  loading={isSubmitting}
                                >
                                  {t('Save All Changes')}
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => { setIsEditing(false); reset(); }}
                                  icon={X}
                                  className="h-14 px-8 rounded-xl"
                                >
                                  {t('Cancel')}
                                </Button>
                              </>
                            ) : (
                               <div className="py-4 text-xs font-bold text-neutral-500 flex items-center gap-2">
                                 <ShieldCheck size={14} className="text-brand-500" />
                                 {t('Address details are locked. Click "Edit Address" above to modify.')}
                               </div>
                            )}

                            {isEditing && isDirty && (
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }}
                                className="text-xs font-bold uppercase tracking-widest text-orange-500 flex items-center gap-3"
                              >
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                {t('Unsaved changes detected')}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>

                    <div className="p-6 rounded-[2rem] bg-brand-500/5 border border-brand-500/10 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-500">
                        <ShieldCheck size={20} />
                      </div>
                      <p className="text-xs font-bold text-neutral-400">
                        {t('Your precise location is never shared with workers until you confirm a booking.')}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'emergency' && (
                  <Card className="p-10 border-none bg-white dark:bg-dark-900 shadow-huge relative overflow-hidden rounded-[3rem]">
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-error-500/5 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
                      <div>
                        <h2 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none mb-3">{t('Safety Protocol')}</h2>
                        <div className="flex items-center gap-3">
                           <div className="p-1 rounded-md bg-error-500 text-white"><Siren size={14} /></div>
                           <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{t('SOS Response System Active')}</p>
                        </div>
                      </div>
                      {!showContactForm && contacts.length < 5 && (
                        <Button size="lg" icon={UserPlus} onClick={() => setShowContactForm(true)} className="rounded-2xl h-14 px-8 font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-500/20">
                          {t('Register Agent')}
                        </Button>
                      )}
                    </div>

                    <div className="space-y-6">
                      <AnimatePresence>
                        {showContactForm && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            exit={{ opacity: 0, height: 0 }}
                            className="p-6 rounded-3xl border border-brand-200 bg-brand-50/10 dark:border-brand-500/20 mb-6"
                          >
                             <div className="grid gap-4 sm:grid-cols-2 mb-4">
                                <Input 
                                  label={t("Name")} 
                                  value={contactForm.name} 
                                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                  placeholder="e.g. Rahul Patil"
                                />
                                <Input 
                                  label={t("Phone")} 
                                  value={contactForm.phone} 
                                  onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                  placeholder="10-digit number"
                                />
                             </div>
                             <div className="flex gap-2 flex-wrap mb-4">
                               {['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'].map(r => (
                                 <button 
                                   key={r} type="button" 
                                   onClick={() => setContactForm(f => ({ ...f, relation: r }))}
                                   className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${contactForm.relation === r ? 'bg-brand-500 text-white border-brand-500' : 'border-neutral-200 dark:border-dark-700'}`}
                                 >
                                   {t(r)}
                                 </button>
                               ))}
                             </div>
                              <div className="flex gap-3">
                               <Button 
                                 size="sm" 
                                 onClick={() => {
                                   if (!contactForm.name || !contactForm.phone || !contactForm.relation) {
                                     toastError(t('Please fill all fields and select a relationship.'));
                                     return;
                                   }
                                   addContactMutation.mutate(contactForm);
                                 }} 
                                 loading={addContactMutation.isPending}
                               >
                                 {t('Add Contact')}
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => setShowContactForm(false)}>
                                 {t('Cancel')}
                               </Button>
                             </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {contacts.length === 0 && !isLoadingContacts && (
                         <div className="text-center py-10 opacity-50">
                           <ShieldAlert size={48} className="mx-auto mb-4" />
                           <p className="text-sm font-bold">{t('No contacts added yet.')}</p>
                         </div>
                      )}

                      {contacts.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-5 rounded-3xl border border-neutral-100 dark:border-dark-800 bg-neutral-50/50 dark:bg-dark-900/20">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500">
                              <UserCircle size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{c.name}</p>
                              <p className="text-xs text-gray-500">{c.phone} • {c.relation}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Trash2} 
                            onClick={() => deleteContactMutation.mutate(c.id)}
                            className="text-error-500"
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {activeTab === 'wallet' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Card className="p-8 border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-sm relative overflow-hidden rounded-2xl group">
                         <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-brand-500/10 transition-colors duration-700" />
                         <div className="relative z-10">
                           <div className="flex items-center justify-between mb-8">
                             <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-500/30">
                                   <Wallet size={20} strokeWidth={2.5} />
                                </div>
                                <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('Digital Wallet')}</span>
                             </div>
                             <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                           </div>
                           
                           <div className="mb-8">
                             <p className="text-xs font-semibold text-neutral-500 mb-1">{t('Available Balance')}</p>
                             <div className="text-4xl font-black text-neutral-900 dark:text-white flex items-baseline tracking-tight">
                               <span className="text-xl font-bold mr-1 text-brand-500">₹</span>
                               {formatCurrencyCompact(walletData?.balance || 0).replace('₹', '')}
                             </div>
                           </div>

                           <Button 
                             onClick={() => navigate('/customer/wallet')}
                             className="rounded-xl h-11 w-full font-semibold text-sm"
                           >
                             {t('Add Money')}
                           </Button>
                         </div>
                      </Card>

                      <Card className="p-8 border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-sm relative overflow-hidden rounded-2xl group">
                         <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors duration-700" />
                         <div className="relative z-10">
                           <div className="flex items-center gap-3 mb-8">
                              <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
                                 <Award size={20} strokeWidth={2.5} />
                              </div>
                              <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('Loyalty Points')}</span>
                           </div>

                           <div className="mb-8">
                             <p className="text-xs font-semibold text-neutral-500 mb-1">{t('Your Score')}</p>
                             <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline tracking-tight">
                               {loyaltyData?.points || 0}
                               <span className="text-sm font-semibold text-neutral-400 ml-2">{t('pts')}</span>
                             </div>
                           </div>

                           <Button 
                             variant="outline"
                             onClick={() => navigate('/customer/loyalty')}
                             className="rounded-xl h-11 w-full font-semibold text-sm"
                           >
                             {t('Redeem Benefits')}
                           </Button>
                         </div>
                      </Card>
                    </div>

                    <Card className="p-8">
                       <h3 className="font-bold text-lg mb-4 flex items-center gap-3">
                         <History size={18} className="text-neutral-400" />
                         {t('Recent Activity')}
                       </h3>
                       <div className="divide-y divide-neutral-100 dark:divide-dark-800">
                         {walletData?.transactions?.slice(0, 3).map(tx => (
                           <div key={tx.id} className="py-4 flex justify-between items-center">
                             <div>
                               <p className="text-sm font-bold text-gray-900 dark:text-white">{tx.description}</p>
                               <p className="text-xs text-gray-500 uppercase tracking-widest">{formatWalletTransactionDate(tx.createdAt)}</p>
                             </div>
                             <span className={`text-sm font-bold ${Number(tx.amount) > 0 ? 'text-success-600' : 'text-gray-900 dark:text-white'}`}>
                               {Number(tx.amount) > 0 ? '+' : ''}{formatCurrencyCompact(Math.abs(Number(tx.amount || 0)))}
                             </span>
                           </div>
                         ))}
                         {(!walletData?.transactions || walletData.transactions.length === 0) && (
                           <EmptyDataState
                             title={t('No recent transactions')}
                             description={t('Your wallet activity will appear here after top-ups and bookings.')}
                             actionLabel={t('Open Wallet')}
                             onAction={() => navigate('/customer/wallet')}
                           />
                         )}
                       </div>
                    </Card>
                  </div>
                )}

                {activeTab === 'account' && (
                  <div className="space-y-6">
                    <Card className="p-8">
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('Account & Referrals')}</h2>
                            <p className="text-sm text-gray-500 mt-1 font-medium">{t('Subscriptions and invitation settings.')}</p>
                        </div>
                        
                        <div className="grid gap-6">
                          <div className="p-8 rounded-[2rem] bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                               <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                 <Award size={32} />
                               </div>
                               <div>
                                 <h4 className="text-xl font-bold text-indigo-900 dark:text-indigo-300">ExpertsHub Plus</h4>
                                 <p className="text-sm font-bold text-indigo-700/70 dark:text-indigo-400/60 transition-colors">
                                   {t('Enjoy zero convenience fees on all bookings.')}
                                 </p>
                               </div>
                            </div>
                            <Button 
                              onClick={() => navigate('/customer/proplus')}
                              className="bg-indigo-600 text-white hover:bg-indigo-700 px-8 rounded-xl h-12 shadow-indigo-600/20 shadow-xl"
                            >
                              {t('Upgrade Now')}
                            </Button>
                          </div>

                          <div className="p-8 rounded-[2rem] border border-neutral-100 dark:border-dark-800 bg-neutral-50/50 dark:bg-dark-900/40">
                             <div className="flex items-center gap-3 mb-6">
                               <Gift size={20} className="text-brand-500" />
                               <h4 className="font-bold text-lg">{t('Refer & Earn')}</h4>
                             </div>
                             <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 px-6 h-14 bg-white dark:bg-dark-950 rounded-xl border-2 border-dashed border-neutral-200 dark:border-dark-700 flex items-center justify-between">
                                  <span className="font-bold tracking-[0.2em] text-brand-600">{referralData?.referralCode || '------'}</span>
                                  <button onClick={() => handleCopyRef(referralData?.referralCode)} className="text-neutral-400 hover:text-brand-500">
                                    {copiedRef ? <Check size={18} /> : <Copy size={18} />}
                                  </button>
                                </div>
                                <Button 
                                  variant="primary" 
                                  icon={Share2}
                                  onClick={() => navigate('/customer/referrals')}
                                  className="rounded-xl h-14 px-8 font-bold text-xs uppercase"
                                >
                                  {t('Share Reward')}
                                </Button>
                             </div>
                             <p className="mt-4 text-xs font-bold text-neutral-400 pl-1">{t('Earn ₹50 for every friend who joins.')}</p>
                          </div>
                        </div>
                    </Card>

                    <Card className="p-10 border border-neutral-100 dark:border-white/5 rounded-[3rem] shadow-huge">
                       <div className="mb-10">
                          <h3 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tighter flex items-center gap-4">
                            <div className="p-2 bg-neutral-100 dark:bg-dark-800 rounded-xl"><Lock size={20} className="text-neutral-400" /></div>
                            {t('Access Protocol')}
                          </h3>
                       </div>

                       <div className="space-y-6">
                         <div className="flex flex-col sm:flex-row items-center justify-between p-8 rounded-[2rem] bg-neutral-50 dark:bg-dark-950/40 border border-neutral-100 dark:border-white/5 gap-6">
                            <div className="flex items-center gap-6">
                               <div className="w-14 h-14 rounded-2xl bg-white dark:bg-dark-800 flex items-center justify-center shadow-sm">
                                  <Lock size={24} className="text-brand-500" />
                               </div>
                               <div>
                                 <p className="text-lg font-black text-neutral-900 dark:text-white leading-none mb-1">{t('Neural Password')}</p>
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('Last rotation: 3 months ago')}</p>
                               </div>
                            </div>
                            {!showPasswordForm && (
                              <Button 
                                variant="outline" 
                                className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest border-neutral-200 dark:border-white/10"
                                onClick={() => setShowPasswordForm(true)}
                              >
                                {t('Initialize Reset')}
                              </Button>
                            )}
                         </div>

                         <div className="flex flex-col sm:flex-row items-center justify-between p-8 rounded-[2rem] bg-neutral-50 dark:bg-dark-950/40 border border-neutral-100 dark:border-white/5 gap-6 opacity-60">
                            <div className="flex items-center gap-6">
                               <div className="w-14 h-14 rounded-2xl bg-white dark:bg-dark-800 flex items-center justify-center shadow-sm">
                                  <ShieldCheck size={24} className="text-emerald-500" />
                               </div>
                               <div>
                                 <p className="text-lg font-black text-neutral-900 dark:text-white leading-none mb-1">{t('Biometric Auth')}</p>
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('Supported on mobile app')}</p>
                               </div>
                            </div>
                            <Badge variant="glass" className="font-black text-[10px] uppercase px-4 py-2 border-emerald-500/20 text-emerald-600 bg-emerald-500/5 items-center gap-2">
                               <CheckCircle size={12} /> {t('Verified')}
                            </Badge>
                          </div>

                         <AnimatePresence>
                           {showPasswordForm && (
                             <motion.div 
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: 'auto', opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden"
                             >
                               <form onSubmit={handlePasswordSubmit} className="mt-4 p-6 rounded-3xl border border-neutral-100 dark:border-dark-800 bg-white dark:bg-dark-900/40 space-y-5">
                                 <div className="flex items-center justify-between mb-2">
                                   <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500">
                                       <ShieldCheck size={20} />
                                     </div>
                                     <h4 className="font-bold text-sm">{t('Update Security')}</h4>
                                   </div>
                                   <button 
                                     type="button"
                                     onClick={() => setShowPasswordForm(false)}
                                     className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                   >
                                     <X size={20} />
                                   </button>
                                 </div>

                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-2">
                                     <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">{t('Current Password')}</label>
                                     <Input 
                                       type="password" 
                                       required
                                       value={passwordForm.currentPassword}
                                       onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                       placeholder="••••••••"
                                       className="bg-gray-50/50 dark:bg-dark-950/50"
                                     />
                                   </div>
                                   <div className="space-y-2">
                                     <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">{t('New Password')}</label>
                                     <Input 
                                       type="password" 
                                       required
                                       value={passwordForm.newPassword}
                                       onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                       placeholder="••••••••"
                                       className="bg-gray-50/50 dark:bg-dark-950/50"
                                     />
                                   </div>
                                   <div className="space-y-2 md:col-span-2">
                                     <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">{t('Confirm New Password')}</label>
                                     <Input 
                                       type="password" 
                                       required
                                       value={passwordForm.confirmPassword}
                                       onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                       placeholder="••••••••"
                                       className="bg-gray-50/50 dark:bg-dark-950/50"
                                     />
                                   </div>
                                 </div>

                                 <div className="flex gap-3 pt-2">
                                   <Button 
                                     type="submit" 
                                     loading={changePasswordMutation.isPending}
                                     className="flex-1 h-12 rounded-2xl font-bold text-xs uppercase"
                                   >
                                     {t('Save New Password')}
                                   </Button>
                                   <Button 
                                     variant="ghost"
                                     type="button"
                                     onClick={() => setShowPasswordForm(false)}
                                     className="h-12 px-6 rounded-2xl font-bold text-xs uppercase"
                                   >
                                     {t('Cancel')}
                                   </Button>
                                 </div>
                               </form>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>
                    </Card>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </MainLayout>
    );
  }

// Internal reusable components for the new UI
function Banner({ children, variant = 'info', icon: Icon }) {
  return (
    <div className={`
      flex items-start gap-3 p-4 rounded-2xl border
      ${variant === 'info' ? 'bg-brand-50 border-brand-100 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/20 dark:text-brand-300' : ''}
    `}>
      {Icon && <Icon size={18} className="mt-0.5 shrink-0" />}
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

