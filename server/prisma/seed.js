const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    console.log('--- Seeding Project UrbanPro V2 ---');

    // 1. Create ADMIN
    const admin = await prisma.user.upsert({
        where: { email: 'admin@urbanpro.com' },
        update: {
            passwordHash: hashedPassword,
            isProfileComplete: true,
            emailVerified: true
        },
        create: {
            name: 'Super Admin',
            email: 'admin@urbanpro.com',
            passwordHash: hashedPassword,
            mobile: '9999999999',
            role: 'ADMIN',
            emailVerified: true,
            isProfileComplete: true,
        },
    });
    console.log('✅ Admin account created: admin@urbanpro.com');

    // 2. Create Categories & Services
    const categories = [
        {
            name: 'Home Maintenance',
            services: [
                { name: 'Plumbing Repair', basePrice: 499 },
                { name: 'Electrical Wiring', basePrice: 399 },
                { name: 'Full Home Painting', basePrice: 4999 },
                { name: 'Carpenter Works', basePrice: 599 },
            ],
        },
        {
            name: 'Cleaning & Pest Control',
            services: [
                { name: 'Deep Home Cleaning', basePrice: 1999 },
                { name: 'Kitchen Cleaning', basePrice: 899 },
                { name: 'Bathroom Cleaning', basePrice: 499 },
                { name: 'Pest Control', basePrice: 1299 },
            ],
        },
        {
            name: 'Appliance Repair',
            services: [
                { name: 'AC Service & Repair', basePrice: 599 },
                { name: 'Washing Machine Repair', basePrice: 449 },
                { name: 'Refrigerator Repair', basePrice: 549 },
                { name: 'Microwave Repair', basePrice: 349 },
            ],
        },
        {
            name: 'Personal Care',
            services: [
                { name: 'Salon for Women', basePrice: 799 },
                { name: 'Haircut for Men', basePrice: 299 },
                { name: 'Massage Therapy', basePrice: 1499 },
            ],
        },
    ];

    for (const cat of categories) {
        for (const svc of cat.services) {
            await prisma.service.upsert({
                where: { name: svc.name },
                update: {
                    category: cat.name,
                    basePrice: svc.basePrice,
                },
                create: {
                    name: svc.name,
                    category: cat.name,
                    basePrice: svc.basePrice,
                    description: `Professional ${svc.name} services by verified experts. Quality guaranteed.`,
                },
            });
        }
    }
    console.log('✅ 15+ Services across 4 categories populated.');

    // 3. Create TEST WORKER (Fully Verified)
    const workerEmail = 'worker@test.com';
    const worker = await prisma.user.upsert({
        where: { email: workerEmail },
        update: {
            passwordHash: hashedPassword,
            emailVerified: true,
            isProfileComplete: true,
        },
        create: {
            name: 'John Expert',
            email: workerEmail,
            passwordHash: hashedPassword,
            mobile: '9876543210',
            role: 'WORKER',
            emailVerified: true,
            isProfileComplete: true,
            workerProfile: {
                create: {
                    skills: ['Plumbing Repair', 'AC Service & Repair'],
                    bio: 'Top-rated professional with 10 years of experience in maintenance.',
                    isVerified: true,
                    rating: 4.8,
                    totalReviews: 24,
                }
            }
        },
        include: { workerProfile: true }
    });

    // Link services to worker
    const plumbingSvc = await prisma.service.findUnique({ where: { name: 'Plumbing Repair' } });
    const acSvc = await prisma.service.findUnique({ where: { name: 'AC Service & Repair' } });

    if (worker.workerProfile) {
        await prisma.workerService.upsert({
            where: { workerId_serviceId: { workerId: worker.workerProfile.id, serviceId: plumbingSvc.id } },
            update: {},
            create: { workerId: worker.workerProfile.id, serviceId: plumbingSvc.id }
        });
        await prisma.workerService.upsert({
            where: { workerId_serviceId: { workerId: worker.workerProfile.id, serviceId: acSvc.id } },
            update: {},
            create: { workerId: worker.workerProfile.id, serviceId: acSvc.id }
        });
    }
    console.log('✅ Verified Worker created: worker@test.com (Password: password123)');

    // 4. Create TEST CUSTOMER
    const customerEmail = 'customer@test.com';
    await prisma.user.upsert({
        where: { email: customerEmail },
        update: {
            passwordHash: hashedPassword,
            emailVerified: true,
            isProfileComplete: true,
        },
        create: {
            name: 'Alice Smith',
            email: customerEmail,
            passwordHash: hashedPassword,
            mobile: '9123456780',
            role: 'CUSTOMER',
            emailVerified: true,
            isProfileComplete: true,
            addresses: {
                create: {
                    line1: '123, Green Valley',
                    line2: 'Silicon City',
                    city: 'Nagpur',
                    state: 'Maharashtra',
                    postalCode: '440001',
                    country: 'India'
                }
            }
        },
    });
    console.log('✅ Customer account created: customer@test.com (Password: password123)');

    console.log('--- Seeding Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
