import { prisma } from '../src/lib/db';

async function main() {
  console.log('Inserting/Upserting "Qissat - One & Only" product into DB...');

  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/alhanan-qissat-one-and-only-1794830430244-dqjb08.webp`;

  // 1. Upsert Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'alhanan-senses' },
    update: {
      nameAr: 'الحنان سينسز',
      nameEn: 'ALHANAN Senses',
      isVisible: true,
    },
    create: {
      slug: 'alhanan-senses',
      nameAr: 'الحنان سينسز',
      nameEn: 'ALHANAN Senses',
      description: 'علامة تجارية متخصصة في العناية بالجسم والتعطير الفاخر.',
      isVisible: true,
    }
  });
  console.log('Brand ready:', brand.nameAr, brand.id);

  // 2. Find Category (معطرات جسم وبودي سبلاش or fallback)
  let category = await prisma.category.findUnique({
    where: { slug: 'body-splash' }
  });

  if (!category) {
    category = await prisma.category.findFirst({
      where: { name: { contains: 'عطور' } }
    });
  }

  if (!category) {
    throw new Error('Category not found!');
  }
  console.log('Category selected:', category.name, category.id);

  // 3. Find Supplier (مورد رَواق للجمال)
  const supplier = await prisma.supplier.findFirst({
    where: { isActive: true }
  });
  console.log('Supplier selected:', supplier?.name, supplier?.id);

  // 4. Upsert Product
  const productSku = 'PERF-SET-001';
  const productSlug = 'alhanan-qissat-one-and-only-set';

  // Delete existing if re-running to ensure clean state
  const existingProduct = await prisma.product.findUnique({
    where: { slug: productSlug }
  });

  if (existingProduct) {
    console.log('Cleaning up existing product with same slug to re-insert cleanly...');
    await prisma.product.delete({ where: { id: existingProduct.id } });
  }

  const product = await prisma.product.create({
    data: {
      sku: productSku,
      slug: productSlug,
      nameAr: 'مجموعة العناية والتعطير الفاخرة للجسم "قصة" (One & Only) - قطعتين 300 مل',
      nameEn: 'ALHANAN Senses "Qissat" (One & Only) Luxury Body Care Set',
      shortDescription: 'ثنائية ساحرة تجمع بين الانتعاش العطري الفاخر والترطيب العميق، بعبق أنثوي فواح يدوم طوال اليوم.',
      longDescription: `مجموعة "قصة - One & Only" الفاخرة من ماركة ALHANAN Senses تقدم لكِ روتيناً يومياً متكاملاً للعناية والتعطير:\n\n• بخاخ سبلاش معطر للجسم (300 مل): رذاذ خفيف ومنعش يغمر حواسك برائحة فخمة وأنثوية مستوحاة من نفحات عطر قصة الشهير بتوليفة الباشن فروت والخوخ والياسمين والكراميل والمسك الأبيض والعنبر.\n• لوشن مرطب ومغذي للبشرة (300 مل): كريم غني وناعم يمنح بشرتك ترطيباً فائقاً وملمساً كالحرير ويحميها من الجفاف مع مضخة عملية لسهولة الاستخدام.\n\nتوليفة ساحرة تجمع بين الأناقة وثبات الرائحة طوال اليوم لتمنحك إطلالة مميزة تأسر الحواس.`,
      categoryId: category.id,
      brandId: brand.id,
      howToUse: 'يُوزع اللوشن المرطب على بشرة نظيفة بعد الاستحمام بحركات دائرية حتى تمتصه البشرة تماماً، ثم يُرش البخاخ المعطر على الجسم ومناطق النبض لمضاعفة الثبات والانتعاش.',
      benefits: 'ترطيب مكثف للبشرة | ثبات عطري يدوم طوال اليوم | ملمس حريري غير لزج | حجم اقتصادي كبير 300 مل لكل عبوة',
      tags: 'سبلاش,لوشن,عناية بالجسم,قصة,ون اند اونلي,الحنان,عطور',
      isVisible: true,
      isFeatured: true,
      featuredOrder: 1,
      stockStatus: 'AVAILABLE',
      inventoryMode: 'FINISHED_PRODUCT',
      notesStatus: 'VERIFIED',
      images: {
        create: [
          {
            url: imageUrl,
            alt: 'مجموعة العناية والتعطير الفاخرة للجسم قصة - Alhanan Senses',
            type: 'PRIMARY',
            isMain: true,
            order: 0,
          }
        ]
      },
      variants: {
        create: [
          {
            sku: `${productSku}-STD`,
            size: 'طقم قطعتين (300 مل × 2)',
            name: 'طقم التعطير والترطيب الكامل',
            price: 5000, // 5.00 JOD
            compareAt: 7000, // 7.00 JOD
            stock: 50,
            isActive: true,
            mainImage: imageUrl,
            usesGlobalPricing: true,
            inventorySource: supplier ? 'SUPPLIER' : 'INTERNAL',
            ...(supplier && {
              supplierOffers: {
                create: [
                  {
                    supplierId: supplier.id,
                    unitCost: 3000, // 3.00 JOD
                    supplierProfitShareBps: 3000,
                    stock: 50,
                    supplierSku: `SUP-ALHANAN-QISSAT-001`,
                    isActive: true,
                  }
                ]
              }
            })
          }
        ]
      }
    },
    include: {
      images: true,
      variants: {
        include: {
          supplierOffers: true,
        }
      },
      category: true,
      brand: true,
    }
  });

  console.log('SUCCESS! Product created with ID:', product.id);
  console.log('Name:', product.nameAr);
  console.log('Slug:', product.slug);
  console.log('Category:', product.category.name);
  console.log('Price:', (product.variants[0].price / 1000).toFixed(3), 'JOD');
  console.log('Cost:', supplier ? (product.variants[0].supplierOffers[0].unitCost / 1000).toFixed(3) + ' JOD' : 'N/A');
  console.log('Image URL:', product.images[0].url);
}

main().catch(console.error).finally(() => prisma.$disconnect());
