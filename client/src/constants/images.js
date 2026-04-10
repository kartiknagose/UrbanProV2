/**
 * Centralized image URLs for app surfaces and service cards.
 */

export const IMAGES = {
    // Auth & Marketing
    AUTH_LOGIN_BG: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
    AUTH_REGISTER_BG: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
    HERO_LANDING: 'https://tse4.mm.bing.net/th/id/OIP.m5keiSbkHU176I74w32CNgHaEK?rs=1&pid=ImgDetMain&o=7&rm=3',

    // Service Categories (user-provided sources)
    CATEGORY_CLEANING: 'https://tse1.mm.bing.net/th/id/OIP.XTpGpugbZ3NTl6zyT7bAiwHaEU?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_PLUMBING: 'https://tse2.mm.bing.net/th/id/OIP.rrS1D2mztOgAeFiLX3n1LQHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_ELECTRICAL: 'https://tse4.mm.bing.net/th/id/OIP.m5keiSbkHU176I74w32CNgHaEK?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_PAINTING: 'https://mywallworks.com/wp-content/uploads/2018/08/hiring-a-painter.jpeg',
    CATEGORY_AC: 'https://tse2.mm.bing.net/th/id/OIP.gl1FGkxb4d_gR-kjT696WwHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_APPLIANCE_REPAIR: 'https://tse3.mm.bing.net/th/id/OIP.yYxxiSGbU4jXiKI80oPptwHaEK?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_CARPENTRY: 'https://img.freepik.com/premium-photo/carpenter-male-worker-cuts-wood-with-circular-saw-wooden-house-construction-lumber-factory-construction-site_140555-2831.jpg',
    CATEGORY_BEAUTY: 'https://tse1.mm.bing.net/th/id/OIP.8HRu8PHWwjtSOtPW5nDL8QHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_PERSONAL_CARE: 'https://tse2.mm.bing.net/th/id/OIP.Qrx1QXzg7piOTIV3gsgFFwHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_PEST_CONTROL: 'https://tse1.mm.bing.net/th/id/OIP.4l_IZaVck-m5ujyhYVYgrgHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    CATEGORY_DEFAULT: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',

    // Specific service images
    SERVICE_WASHING_MACHINE_REPAIR: 'https://tse3.mm.bing.net/th/id/OIP.yYxxiSGbU4jXiKI80oPptwHaEK?rs=1&pid=ImgDetMain&o=7&rm=3',
    SERVICE_REFRIGERATOR_REPAIR: 'https://tse1.mm.bing.net/th/id/OIP.xBMrb1ZwE-rxQlwDf94QzQHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    SERVICE_MICROWAVE_REPAIR: 'https://tse3.mm.bing.net/th/id/OIP.RP3QKkwSmzub1_BS0GUAMAHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    SERVICE_SALON_WOMEN: 'https://tse1.mm.bing.net/th/id/OIP.8HRu8PHWwjtSOtPW5nDL8QHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
    SERVICE_SALON_MEN: 'https://tse1.mm.bing.net/th/id/OIP.lyk2c5Ui0UwQcl3ToY8AqgHaEz?rs=1&pid=ImgDetMain&o=7&rm=3',
    SERVICE_MASSAGE: 'https://tse2.mm.bing.net/th/id/OIP.Qrx1QXzg7piOTIV3gsgFFwHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',

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

    // Specific service mappings should come before broader category checks.
    if (norm.includes('washing machine')) return IMAGES.SERVICE_WASHING_MACHINE_REPAIR;
    if (norm.includes('refrigerator') || norm.includes('fridge') || norm.includes('refrigirator')) return IMAGES.SERVICE_REFRIGERATOR_REPAIR;
    if (norm.includes('microwave')) return IMAGES.SERVICE_MICROWAVE_REPAIR;
    if (norm.includes('salon for women')) return IMAGES.SERVICE_SALON_WOMEN;
    if (norm.includes('salon for men')) return IMAGES.SERVICE_SALON_MEN;
    if (norm.includes('massage')) return IMAGES.SERVICE_MASSAGE;

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
    if (norm.includes('beauty') || norm.includes('hair') || norm.includes('facial') || norm.includes('salon') || norm.includes('spa') || norm.includes('care') || norm.includes('men') || norm.includes('women')) return IMAGES.CATEGORY_PERSONAL_CARE;

    // Pest control
    if (norm.includes('pest') || norm.includes('bug') || norm.includes('insect') || norm.includes('termite') || norm.includes('cockroach') || norm.includes('rodent')) return IMAGES.CATEGORY_PEST_CONTROL;

    // Category-level fallbacks from backend seeded groups
    if (norm.includes('home maintenance')) return IMAGES.CATEGORY_CARPENTRY;
    if (norm.includes('cleaning & pest control')) return IMAGES.CATEGORY_CLEANING;
    if (norm.includes('appliance repair')) return IMAGES.CATEGORY_APPLIANCE_REPAIR;
    if (norm.includes('personal care')) return IMAGES.CATEGORY_PERSONAL_CARE;

    return IMAGES.CATEGORY_DEFAULT;
};
