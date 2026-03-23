/**
 * Centralized collection of high-quality Unsplash images for the application.
 * Using source.unsplash.com with specific keywords and IDs for consistency.
 */

export const IMAGES = {
    // Auth & Marketing
    AUTH_LOGIN_BG: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
    AUTH_REGISTER_BG: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
    HERO_LANDING: 'https://images.unsplash.com/photo-1581578731117-104f2a412727?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',

    // Service Categories (Thumbnails)
    CATEGORY_CLEANING: 'https://images.unsplash.com/photo-1581578731117-104f2a412727?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_PLUMBING: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_ELECTRICAL: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_PAINTING: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_AC: 'https://images.unsplash.com/photo-1621905252507-b35492cc253e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_APPLIANCE_REPAIR: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a45e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_CARPENTRY: 'https://images.unsplash.com/photo-1622675363311-ac05f3a0c9a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_BEAUTY: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_PERSONAL_CARE: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_PEST_CONTROL: 'https://images.unsplash.com/photo-1588612140418-47bf20977462?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    CATEGORY_DEFAULT: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',

    // User Avatars
    AVATAR_USER_1: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    AVATAR_USER_2: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    AVATAR_WORKER_1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    AVATAR_WORKER_2: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',

    // Banners
    PROMO_SUMMER: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    PROMO_DEAL: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
};

export const getServiceImage = (input) => {
    const norm = (typeof input === 'string' ? input : '').toLowerCase();

    // Use dynamic generic images based on keywords if we don't have a specific mapping, 
    // or fallback to the category mapping above.
    // For specific service names, we can return a direct unsplash search URL to be more dynamic.

    // NOTE: Direct unsplash source is deprecated. We must rely on our fixed list or a proxy.
    // Let's improve the matching logic to map specific tasks to our fixed categories better.

    // Cleaning services
    if (norm.includes('clean') || norm.includes('maid') || norm.includes('house') || norm.includes('sweep') || norm.includes('mop') || norm.includes('dust') || norm.includes('kitchen') || norm.includes('bathroom')) return IMAGES.CATEGORY_CLEANING;

    // Plumbing services
    if (norm.includes('plumb') || norm.includes('water') || norm.includes('pipe') || norm.includes('leak') || norm.includes('drain') || norm.includes('tap') || norm.includes('basin')) return IMAGES.CATEGORY_PLUMBING;

    // Electrical services
    if (norm.includes('electric') || norm.includes('wire') || norm.includes('power') || norm.includes('switch') || norm.includes('light') || norm.includes('fan')) return IMAGES.CATEGORY_ELECTRICAL;

    // Painting services
    if (norm.includes('paint') || norm.includes('wall') || norm.includes('color') || norm.includes('white wash')) return IMAGES.CATEGORY_PAINTING;

    // Cooling & AC services
    if (norm.includes('ac') || norm.includes('air') || norm.includes('cool') || norm.includes('freeze')) return IMAGES.CATEGORY_AC;

    // Appliance repair services
    if (norm.includes('appliance') || norm.includes('machine') || norm.includes('washing') || norm.includes('refrigerator') || norm.includes('fridge') || norm.includes('microwave') || norm.includes('oven')) return IMAGES.CATEGORY_APPLIANCE_REPAIR;

    // Carpentry services
    if (norm.includes('carpenter') || norm.includes('wood') || norm.includes('furniture') || norm.includes('door') || norm.includes('drill') || norm.includes('cabinet')) return IMAGES.CATEGORY_CARPENTRY;

    // Beauty & personal care services
    if (norm.includes('beauty') || norm.includes('hair') || norm.includes('facial') || norm.includes('massage') || norm.includes('salon') || norm.includes('spa') || norm.includes('care') || norm.includes('men') || norm.includes('women')) return IMAGES.CATEGORY_PERSONAL_CARE;

    // Pest control
    if (norm.includes('pest') || norm.includes('bug') || norm.includes('insect') || norm.includes('termite') || norm.includes('cockroach') || norm.includes('rodent')) return IMAGES.CATEGORY_PEST_CONTROL;

    // Category-level fallbacks from backend seeded groups
    if (norm.includes('home maintenance')) return IMAGES.CATEGORY_CARPENTRY;
    if (norm.includes('cleaning & pest control')) return IMAGES.CATEGORY_CLEANING;
    if (norm.includes('appliance repair')) return IMAGES.CATEGORY_APPLIANCE_REPAIR;
    if (norm.includes('personal care')) return IMAGES.CATEGORY_PERSONAL_CARE;

    return IMAGES.CATEGORY_DEFAULT;
};
