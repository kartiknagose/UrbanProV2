import { Share2, Facebook, Twitter, MessageCircle, Copy, Link as LinkIcon } from 'lucide-react';
import { Button } from '../../common';
import { toast } from 'sonner';

/**
 * SOCIAL SHARE COMPONENT (Sprint 17 - #84)
 * Allows sharing referral links, services, or profiles.
 */
export function SocialShare({ 
    url = window.location.href, 
    title = 'Check out UrbanPro V2!',
    text = 'Get reliable services at home with UrbanPro.',
    variant = 'minimal' // 'minimal', 'full', 'row'
}) {
    const shareData = {
        title,
        text,
        url
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Share failed:', err);
            }
        } else {
            await handleCopyLink();
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Link copied to clipboard!');
        } catch {
            toast.error('Unable to copy link. Please copy it manually.');
        }
    };

    const shareLinks = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    };

    const openShareLink = (shareUrl) => {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };

    if (variant === 'minimal') {
        return (
            <Button 
                variant="ghost" 
                size="sm" 
                icon={Share2} 
                onClick={handleNativeShare}
                className="rounded-full h-8 w-8 p-0"
            />
        );
    }

    return (
        <div className={`flex flex-wrap gap-2 ${variant === 'row' ? 'items-center' : 'flex-col'}`}>
            <Button 
                variant="outline" 
                size="sm" 
                icon={MessageCircle} 
                onClick={() => openShareLink(shareLinks.whatsapp)}
                className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
            >
                WhatsApp
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                icon={Facebook} 
                onClick={() => openShareLink(shareLinks.facebook)}
                className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
            >
                Facebook
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                icon={Twitter} 
                onClick={() => openShareLink(shareLinks.twitter)}
                className="bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
            >
                Twitter
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                icon={LinkIcon} 
                onClick={handleCopyLink}
            >
                Copy Link
            </Button>
        </div>
    );
}
