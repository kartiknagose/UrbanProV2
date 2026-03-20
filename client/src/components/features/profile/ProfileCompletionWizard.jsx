import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  User,
  MapPin,
  Phone,
  Camera,
  AlertCircle,
  Upload,
  X,
  LoaderCircle,
} from 'lucide-react';
import { Button, Badge, Card, Input, Textarea, Avatar, AsyncState } from '../../common';
import { LocationPicker } from '../location/LocationPicker';
import { AddressAutocomplete } from '../location/AddressAutocomplete';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'sonner';

const STEP_TITLES_CUSTOMER = {
  contact: 'Contact Info',
  address: 'Primary Address',
  photo: 'Profile Photo',
  confirm: 'Confirmation',
};

const STEP_TITLES_WORKER = {
  about: 'About Yourself',
  services: 'Services & Rates',
  location: 'Service Area',
  documents: 'Documents',
  confirm: 'Confirmation',
};

const ProfileCompletionStep = ({ step, isActive, isCompleted, title, icon: Icon }) => (
  <div className={`flex items-center gap-2 sm:gap-3 transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`}>
    <div
      className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shrink-0 ${
        isCompleted
          ? 'bg-success-500 text-white'
          : isActive
            ? 'bg-brand-500 text-white ring-2 ring-brand-300'
            : 'bg-neutral-200 dark:bg-dark-700 text-neutral-600 dark:text-neutral-400'
      }`}
    >
      {isCompleted ? <CheckCircle2 size={18} /> : step + 1}
    </div>
    <div className="hidden xs:block">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{`Step ${step + 1}`}</p>
      <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1">
        {Icon && <Icon size={14} />} {title}
      </p>
    </div>
  </div>
);

export function ProfileCompletionWizard({ userRole, onComplete, onSkip }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(user?.profilePhotoUrl || '');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isCustomer = userRole === 'CUSTOMER';
  const stepTitles = isCustomer ? STEP_TITLES_CUSTOMER : STEP_TITLES_WORKER;
  const totalSteps = Object.keys(stepTitles).length;

  const {
    register,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      phone: user?.mobile || '',
      address: '',
      city: '',
      postalCode: '',
      about: '',
      serviceTitle: '',
      hourlyRate: '',
      bio: '',
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('Please select an image file'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Image must be less than 5MB'));
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploadingPhoto(true);
    try {
      // Preview
      const formData = new FormData();
      formData.append('file', file);
      // Assuming there's an upload endpoint
      toast.success(t('Photo selected'));
    } catch (_err) {
      toast.error(t('Failed to upload photo'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle navigation
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderCustomerStep = () => {
    switch (currentStep) {
      case 0: // Contact Info
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <Phone size={20} className="text-brand-500" /> {t('Your Contact Information')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('Help service providers reach you easily')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                    {t('Mobile Number')}
                  </label>
                  <Input
                    type="tel"
                    placeholder="+91 9876543210"
                    icon={Phone}
                    error={errors.phone?.message}
                    {...register('phone', { required: t('Mobile number is required') })}
                  />
                </div>
              </div>
            </div>
          </Motion.div>
        );

      case 1: // Primary Address
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <MapPin size={20} className="text-brand-500" /> {t('Your Address')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Where should we send service providers?')}</p>
              </div>

              <div className="space-y-4">
                <AddressAutocomplete
                  value={selectedLocation?.address || ''}
                  onChange={(loc) => {
                    setSelectedLocation(loc);
                    setValue('address', loc.address);
                  }}
                  placeholder={t('Search for your address...')}
                />
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-dark-700 h-48">
                  <LocationPicker
                    initialLocation={selectedLocation}
                    onChange={(loc) => {
                      if (loc?.address) {
                        setSelectedLocation(loc);
                        setValue('address', loc.address);
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input label={t('City')} placeholder="Mumbai" {...register('city')} />
                  <Input label={t('Postal Code')} placeholder="400001" {...register('postalCode')} />
                </div>
              </div>
            </div>
          </Motion.div>
        );

      case 2: // Profile Photo
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                  <Camera size={20} className="text-brand-500" /> {t('Profile Photo')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Let workers know who they are meeting')}</p>
              </div>

              <div className="flex justify-center">
                <div className="relative">
                  <Avatar src={profilePhotoPreview} name={user?.name} size="xxl" />
                  <label
                    htmlFor="photo-input"
                    className="absolute bottom-0 right-0 bg-brand-500 hover:bg-brand-600 text-white p-2 rounded-full cursor-pointer transition-all"
                  >
                    <Camera size={20} />
                  </label>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isUploadingPhoto}
                  />
                </div>
              </div>

              {profilePhotoPreview && (
                <div className="p-3 bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 rounded-lg">
                  <p className="text-sm font-bold text-success-700 dark:text-success-400">✓ {t('Photo ready to upload')}</p>
                </div>
              )}

              <div className="p-3 bg-neutral-50 dark:bg-dark-800 rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {t('JPG, PNG or GIF • Max 5MB')}
                </p>
              </div>
            </div>
          </Motion.div>
        );

      case 3: // Confirmation
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} className="text-brand-500" /> {t('Profile Setup Complete!')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('You are all set to use UrbanPro')}</p>
              </div>

              <Card className="bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-success-500" size={20} />
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Contact info updated')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-success-500" size={20} />
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Address registered')}</span>
                </div>
                {profilePhotoPreview && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-success-500" size={20} />
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Profile photo added')}</span>
                  </div>
                )}
              </Card>

              <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/20 rounded-lg">
                <p className="text-sm font-bold text-accent-900 dark:text-accent-100">
                  {t('Start booking services or update your profile later anytime!')}
                </p>
              </div>
            </div>
          </Motion.div>
        );

      default:
        return null;
    }
  };

  const renderWorkerStep = () => {
    switch (currentStep) {
      case 0: // About Yourself
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <User size={20} className="text-brand-500" /> {t('Tell Us About Yourself')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Help customers know you better')}</p>
              </div>

              <div className="space-y-4">
                <Input label={t('Professional Title')} placeholder={t('e.g., Plumber, Electrician')} {...register('serviceTitle')} />
                <Textarea
                  label={t('About You')}
                  placeholder={t('Share your experience, specialties, and why you are the best choice...')}
                  rows={4}
                  {...register('bio')}
                />
              </div>
            </div>
          </Motion.div>
        );

      case 1: // Services & Rates
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <Phone size={20} className="text-brand-500" /> {t('Your Rates')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Set your hourly rate or project-based pricing')}</p>
              </div>

              <div>
                <Input
                  type="number"
                  label={t('Hourly Rate (₹)')}
                  placeholder="500"
                  min="0"
                  step="50"
                  {...register('hourlyRate')}
                />
              </div>
            </div>
          </Motion.div>
        );

      case 2: // Service Area
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <MapPin size={20} className="text-brand-500" /> {t('Service Area')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Where do you provide your services?')}</p>
              </div>

              <AddressAutocomplete
                value={selectedLocation?.address || ''}
                onChange={(loc) => {
                  setSelectedLocation(loc);
                  setValue('address', loc.address);
                }}
                placeholder={t('Enter your base location...')}
              />
              <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-dark-700 h-48">
                <LocationPicker
                  initialLocation={selectedLocation}
                  onChange={(loc) => {
                    if (loc?.address) {
                      setSelectedLocation(loc);
                      setValue('address', loc.address);
                    }
                  }}
                />
              </div>
            </div>
          </Motion.div>
        );

      case 3: // Documents
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <Upload size={20} className="text-brand-500" /> {t('Verification Documents')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('Upload your credentials to get verified')}
                </p>
              </div>

              <div className="p-4 bg-info-50 dark:bg-info-500/10 border border-info-200 dark:border-info-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-info-600 dark:text-info-400 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-info-900 dark:text-info-100 font-medium">
                  {t('You can upload documents now or complete verification later from your profile')}
                </p>
              </div>

              <div className="p-4 border-2 border-dashed border-neutral-300 dark:border-dark-600 rounded-xl text-center cursor-pointer hover:border-brand-400 transition-colors">
                <Upload className="mx-auto text-neutral-400 dark:text-dark-500 mb-2" size={24} />
                <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('Click to upload documents')}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('ID, License, Certificates')}</p>
              </div>
            </div>
          </Motion.div>
        );

      case 4: // Confirmation
        return (
          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} className="text-brand-500" /> {t('Profile Created!')}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('Ready to start earning on UrbanPro')}</p>
              </div>

              <Card className="bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-success-500" size={20} />
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Profile information updated')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-success-500" size={20} />
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Service area set')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-warning-500" size={20} />
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('Pending verification')}</span>
                </div>
              </Card>

              <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/20 rounded-lg">
                <p className="text-sm font-bold text-accent-900 dark:text-accent-100">
                  {t('You can start accepting jobs or upload verification docs from your profile')}
                </p>
              </div>
            </div>
          </Motion.div>
        );

      default:
        return null;
    }
  };

  const handleSubmit2 = async () => {
    if (currentStep === totalSteps - 1) {
      if (onComplete) {
        await onComplete();
      }
    } else {
      handleNext();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-4 px-2 overflow-x-auto">
          {Object.entries(stepTitles).map(([key, title], idx) => (
            <ProfileCompletionStep
              key={key}
              step={idx}
              isActive={currentStep === idx}
              isCompleted={currentStep > idx}
              title={title}
              icon={[User, MapPin, Camera, CheckCircle2, Upload][idx]}
            />
          ))}
        </div>
        <div className="h-1 bg-neutral-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <Motion.div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="mb-8">
        <AnimatePresence mode="wait">{isCustomer ? renderCustomerStep() : renderWorkerStep()}</AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          icon={ChevronLeft}
          onClick={handlePrevious}
          disabled={currentStep === 0}
          size="sm"
        >
          {t('Previous')}
        </Button>

        <Button
          variant="ghost"
          onClick={onSkip}
          size="sm"
          className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        >
          {t('Skip for now')}
        </Button>

        {currentStep < totalSteps - 1 ? (
          <Button icon={ChevronRight} onClick={handleSubmit2} size="sm" className="bg-brand-500 hover:bg-brand-600">
            {t('Next')}
          </Button>
        ) : (
          <Button
            icon={CheckCircle2}
            onClick={handleSubmit2}
            loading={isSubmitting}
            size="sm"
            className="bg-success-500 hover:bg-success-600"
          >
            {t('Complete')}
          </Button>
        )}
      </div>
    </div>
  );
}
