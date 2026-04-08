// Barrel re-exports for all shared components.
// UI primitives live in ../ui/, domain-aware components live here.
// Both are re-exported so existing imports from 'components/common' still work.

// ── UI Primitives (re-exported from ../ui/) ──
export { Button } from '../ui/Button';
export { Input } from '../ui/Input';
export { Textarea } from '../ui/Textarea';
export { Select } from '../ui/Select';
export { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/Card';
export { Badge } from '../ui/Badge';
export { Spinner, LoadingOverlay, LoadingButton } from '../ui/Spinner';
export { Modal, ModalFooter } from '../ui/Modal';
export { ConfirmDialog } from '../ui/ConfirmDialog';
export { Checkbox } from '../ui/Checkbox';

export { Skeleton, BookingCardSkeleton, StatGridSkeleton, SkeletonContainer, ListItemSkeleton } from '../ui/Skeleton';

// ── Domain-aware shared components ──
export { BookingStatusBadge, PaymentStatusBadge, VerificationStatusBadge, RoleBadge, WorkerTierBadge } from './StatusBadges';
export { PageHeader } from './PageHeader';
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { StatCard } from './StatCard';
export { SimpleBarChart, SimpleDonutChart } from './SimpleChart';
export { AsyncState } from './AsyncState';
export { Pagination } from '../ui/Pagination';
export { Breadcrumbs } from './Breadcrumbs';
export { ImageUpload } from './ImageUpload';
export { Avatar } from './Avatar';
export { QuickReview } from './QuickReview';
export { BookingCard } from './BookingCard';
export { OptimizedImage, buildCloudinaryUrl, buildSrcSet } from './OptimizedImage';

