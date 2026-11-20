export type CatalogVariant = {
  key: string;
  nameAr: string;
  nameEn: string;
  image: string;
  size?: string;
  priceFils: number;
  needsReview?: boolean;
};

export type CatalogProduct = {
  slug: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  brand: 'العروسة' | 'COSMO';
  category: string;
  categorySlug: string;
  shortDescription: string;
  variants: CatalogVariant[];
};

const imageRoot = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/products`;

function variants(
  prefix: string,
  priceFils: number,
  values: Array<[key: string, nameAr: string, nameEn: string, size?: string, needsReview?: boolean]>,
): CatalogVariant[] {
  return values.map(([key, nameAr, nameEn, size = 'عبوة واحدة', needsReview = false]) => ({
    key,
    nameAr,
    nameEn,
    size,
    priceFils,
    needsReview,
    image: `${imageRoot}/${prefix}-${key}.webp`,
  }));
}

function single(
  slug: string,
  nameAr: string,
  nameEn: string,
  brand: CatalogProduct['brand'],
  category: string,
  categorySlug: string,
  priceFils: number,
  description: string,
): CatalogProduct {
  return {
    slug,
    sku: `CAT-${slug.toUpperCase()}`,
    nameAr,
    nameEn,
    brand,
    category,
    categorySlug,
    shortDescription: description,
    variants: [{
      key: 'standard',
      nameAr: 'قياسي',
      nameEn: 'Standard',
      size: 'عبوة واحدة',
      priceFils,
      image: `${imageRoot}/${slug}.webp`,
    }],
  };
}

export const catalogBatch78194: CatalogProduct[] = [
  {
    slug: 'alarousa-bikini-scrub', sku: 'CAT-ALAROUSA-BIKINI-SCRUB',
    nameAr: 'مقشر البكيني العروسة', nameEn: 'Al Arousa Bikini Scrub', brand: 'العروسة',
    category: 'العناية الحساسة', categorySlug: 'intimate-care',
    shortDescription: 'مقشر مخصص للعناية الخارجية بمنطقة البكيني، متوفر بعدة روائح ضمن منتج واحد.',
    variants: variants('alarousa-bikini-scrub', 3000, [
      ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'], ['allure', 'رائحة جذابة', 'Allure'],
      ['candy', 'كاندي', 'Candy'], ['strawberry', 'فراولة', 'Strawberry'],
    ]),
  },
  {
    slug: 'alarousa-body-butter', sku: 'CAT-ALAROUSA-BODY-BUTTER',
    nameAr: 'زبدة الجسم العروسة', nameEn: 'Al Arousa Body Butter', brand: 'العروسة',
    category: 'العناية بالجسم', categorySlug: 'body-care',
    shortDescription: 'زبدة جسم مرطبة بروائح متعددة، مجمعة كخيارات لنفس المنتج.',
    variants: variants('alarousa-body-butter', 4000, [
      ['yara', 'يارا', 'Yara'], ['pomegranate', 'رمان', 'Pomegranate'],
      ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'], ['si', 'سي', 'Si'],
      ['cherry', 'كرز', 'Cherry'], ['candy', 'كاندي', 'Candy'], ['love', 'لاف', 'Love'],
      ['sea-breeze', 'نسيم البحر', 'Sea Breeze'], ['mango', 'مانجا', 'Mango'],
      ['strawberry', 'فراولة', 'Strawberry'],
    ]),
  },
  {
    slug: 'alarousa-body-oil', sku: 'CAT-ALAROUSA-BODY-OIL',
    nameAr: 'زيت الجسم العروسة', nameEn: 'Al Arousa Body Oil', brand: 'العروسة',
    category: 'العناية بالجسم', categorySlug: 'body-care',
    shortDescription: 'زيت جسم مرطب بخيارات لونية مختلفة، إضافة إلى خيار Elegance.',
    variants: variants('alarousa-body-oil', 3500, [
      ['pink', 'وردي', 'Pink'], ['gold', 'ذهبي', 'Gold'],
      ['blue', 'أزرق', 'Blue'], ['elegance', 'إليغانس', 'Elegance'],
    ]),
  },
  {
    slug: 'alarousa-body-scrub', sku: 'CAT-ALAROUSA-BODY-SCRUB',
    nameAr: 'مقشر الجسم العروسة', nameEn: 'Al Arousa Body Scrub', brand: 'العروسة',
    category: 'مقشرات الجسم', categorySlug: 'body-scrubs',
    shortDescription: 'مقشر جسم بروائح وتركيبات متعددة ضمن منتج واحد.',
    variants: variants('alarousa-body-scrub', 4000, [
      ['cherry', 'كرز', 'Cherry'], ['si', 'سي', 'Si'], ['yara', 'يارا', 'Yara'],
      ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'], ['strawberry', 'فراولة', 'Strawberry'],
      ['white-musk', 'مسك أبيض', 'White Musk'], ['mogul', 'موغل', 'Mogul'],
      ['pomegranate', 'رمان', 'Pomegranate'], ['activated-charcoal', 'فحم نشط', 'Activated Charcoal'],
      ['passion-fruit', 'باشن فروت', 'Passion Fruit'], ['candy', 'كاندي', 'Candy'],
      ['escada', 'إسكادا', 'Escada'],
    ]),
  },
  {
    slug: 'alarousa-body-soap', sku: 'CAT-ALAROUSA-BODY-SOAP',
    nameAr: 'صابون الجسم العروسة', nameEn: 'Al Arousa Body Soap', brand: 'العروسة',
    category: 'العناية بالجسم', categorySlug: 'body-care',
    shortDescription: 'صابون جسم بخيارات نباتية وعطرية متعددة.',
    variants: variants('alarousa-body-soap', 5000, [
      ['laurel-oil', 'زيت الغار', 'Laurel Oil'], ['rose', 'الورد', 'Rose'],
      ['natural-herbs', 'الأعشاب الطبيعية', 'Natural Herbs'], ['aker-fassi', 'العكر الفاسي', 'Aker Fassi'],
      ['moroccan-nila', 'النيلة المغربية', 'Moroccan Nila'], ['candy', 'كاندي', 'Candy'],
      ['cherry', 'كرز', 'Cherry'], ['aloe-vera', 'ألوفيرا', 'Aloe Vera'],
    ]),
  },
  {
    slug: 'alarousa-body-splash', sku: 'CAT-ALAROUSA-BODY-SPLASH',
    nameAr: 'بودي سبلاش العروسة', nameEn: 'Al Arousa Body Splash', brand: 'العروسة',
    category: 'معطرات الجسم', categorySlug: 'body-mists',
    shortDescription: 'معطر جسم بثلاث روائح؛ رائحة Allure منفصلة عن الفراولة لتفادي الخلط السابق.',
    variants: variants('alarousa-body-splash', 3000, [
      ['allure', 'رائحة جذابة', 'Allure'], ['strawberry', 'فراولة', 'Strawberry'], ['candy', 'كاندي', 'Candy'],
    ]),
  },
  {
    slug: 'alarousa-brush-face-wash', sku: 'CAT-ALAROUSA-BRUSH-FACE-WASH',
    nameAr: 'غسول وجه بالفرشاة العروسة', nameEn: 'Al Arousa Brush Face Wash', brand: 'العروسة',
    category: 'غسول الوجه', categorySlug: 'face-wash',
    shortDescription: 'غسول وجه بفرشاة مدمجة وخيارات متعددة.',
    variants: variants('alarousa-brush-face-wash', 3000, [
      ['rose', 'الورد', 'Rose'], ['aloe-vera', 'ألوفيرا', 'Aloe Vera'], ['licorice', 'عرق السوس', 'Licorice'],
      ['vitamin-c', 'فيتامين سي', 'Vitamin C'], ['moroccan-nila', 'النيلة المغربية', 'Moroccan Nila'],
    ]),
  },
  {
    slug: 'alarousa-feminine-wash', sku: 'CAT-ALAROUSA-FEMININE-WASH',
    nameAr: 'غسول نسائي العروسة', nameEn: 'Al Arousa Feminine Wash', brand: 'العروسة',
    category: 'العناية الحساسة', categorySlug: 'intimate-care',
    shortDescription: 'غسول للعناية الخارجية بروائح متعددة ضمن منتج واحد.',
    variants: variants('alarousa-feminine-wash', 2500, [
      ['strawberry', 'فراولة', 'Strawberry'], ['allure', 'رائحة جذابة', 'Allure'],
      ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'],
    ]),
  },
  {
    slug: 'alarousa-pheromone-musk', sku: 'CAT-ALAROUSA-PHEROMONE-MUSK',
    nameAr: 'مسك فرموني العروسة', nameEn: 'Al Arousa Pheromone Musk', brand: 'العروسة',
    category: 'المسك والعطور', categorySlug: 'musk-perfume',
    shortDescription: 'مسك عطري بروائح متعددة؛ تم استبعاد لقطات كاندي ودلال المكررة.',
    variants: variants('alarousa-pheromone-musk', 3000, [
      ['dalal', 'دلال', 'Dalal'], ['candy', 'كاندي', 'Candy'], ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'],
      ['tahara', 'الطهارة', 'Tahara'], ['strawberry', 'فراولة', 'Strawberry'], ['sexy', 'سيكسي', 'Sexy'],
      ['pomegranate', 'رمان', 'Pomegranate'], ['sea-breeze', 'نسيم البحر', 'Sea Breeze'],
      ['vanilla', 'فانيلا', 'Vanilla'], ['mango', 'مانجا', 'Mango'], ['silk', 'الحرير', 'Silk'],
    ]),
  },
  {
    slug: 'cosmo-body-lotion', sku: 'CAT-COSMO-BODY-LOTION',
    nameAr: 'لوشن الجسم COSMO', nameEn: 'COSMO Body Lotion', brand: 'COSMO',
    category: 'لوشن الجسم', categorySlug: 'body-lotion',
    shortDescription: 'لوشن جسم مرطب بخيارات وروائح وأحجام متعددة ضمن منتج واحد.',
    variants: variants('cosmo-body-lotion', 3000, [
      ['papaya', 'بابايا للتفتيح', 'Papaya Brightening', '750 مل'],
      ['radiant-cocoa', 'كاكاو مشرق', 'Radiant Cocoa', '750 مل'],
      ['soothing-aloe-vera', 'ألوفيرا مهدئ', 'Soothing Aloe Vera', '750 مل'],
      ['raw-shea-butter', 'زبدة الشيا الخام', 'Raw Shea Butter', '750 مل'],
      ['vanilla-honey', 'فانيلا وعسل', 'Vanilla & Honey', '400 مل'],
      ['exotic-fruits', 'فواكه استوائية', 'Exotic Fruits', '400 مل'],
      ['english-rose', 'ورد إنجليزي', 'English Rose', '400 مل'],
      ['argan-butter', 'زبدة الأرغان', 'Argan Butter', '400 مل'],
      ['mixed-berries', 'توت مشكل', 'Mixed Berries', '400 مل'],
    ]),
  },
  {
    slug: 'cosmo-face-mask', sku: 'CAT-COSMO-FACE-MASK',
    nameAr: 'ماسك الوجه COSMO', nameEn: 'COSMO Face Mask', brand: 'COSMO',
    category: 'ماسكات الوجه', categorySlug: 'face-masks',
    shortDescription: 'ماسك وجه بحجم 500 مل وخيارات متعددة.',
    variants: variants('cosmo-face-mask', 3000, [
      ['gold', 'ذهب', 'Gold', '500 مل'], ['rice-milk', 'حليب الأرز', 'Rice Milk', '500 مل'],
      ['milk-honey', 'حليب وعسل', 'Milk & Honey', '500 مل'], ['charcoal', 'فحم', 'Charcoal', '500 مل'],
      ['cucumber-aloe-vera', 'خيار وألوفيرا', 'Cucumber & Aloe Vera', '500 مل'],
      ['pink-lemon-mandarin', 'ليمون وردي وماندرين', 'Pink Lemon & Mandarin', '500 مل'],
    ]),
  },
  {
    slug: 'cosmo-foaming-face-wash', sku: 'CAT-COSMO-FOAMING-FACE-WASH',
    nameAr: 'غسول وجه رغوي COSMO', nameEn: 'COSMO Foaming Face Wash', brand: 'COSMO',
    category: 'غسول الوجه', categorySlug: 'face-wash',
    shortDescription: 'غسول وجه رغوي بفرشاة وخيارات عناية متعددة.',
    variants: variants('cosmo-foaming-face-wash', 3000, [
      ['aloe-vera', 'ألوفيرا', 'Aloe Vera'], ['vitamin-c', 'فيتامين سي', 'Vitamin C'],
      ['hyaluronic-acid', 'حمض الهيالورونيك', 'Hyaluronic Acid'], ['gold', 'ذهب', 'Gold'],
      ['retinol-collagen-rose-water', 'ريتينول وكولاجين وماء ورد', 'Retinol, Collagen & Rose Water'],
      ['niacinamide-licorice', 'نياسيناميد وعرق السوس', 'Niacinamide & Licorice'],
    ]),
  },
  {
    slug: 'cosmo-salt-body-scrub', sku: 'CAT-COSMO-SALT-BODY-SCRUB',
    nameAr: 'مقشر الجسم الملحي COSMO', nameEn: 'COSMO Salt Body Scrub', brand: 'COSMO',
    category: 'مقشرات الجسم', categorySlug: 'body-scrubs',
    shortDescription: 'مقشر ملحي للجسم بخيارات متعددة.',
    variants: variants('cosmo-salt-body-scrub', 3500, [
      ['hemp-coconut-lime', 'قنب وجوز هند ولايم', 'Hemp & Coconut Lime'],
      ['himalayan', 'ملح الهيمالايا', 'Himalayan Salt'],
    ]),
  },
  {
    slug: 'cosmo-shea-sugar-scrub', sku: 'CAT-COSMO-SHEA-SUGAR-SCRUB',
    nameAr: 'مقشر السكر بزبدة الشيا COSMO', nameEn: 'COSMO Shea Sugar Scrub', brand: 'COSMO',
    category: 'مقشرات الجسم', categorySlug: 'body-scrubs',
    shortDescription: 'مقشر سكر بزبدة الشيا بنكهات متعددة.',
    variants: variants('cosmo-shea-sugar-scrub', 3500, [
      ['strawberry', 'فراولة', 'Strawberry'], ['vitamin-c', 'فيتامين سي', 'Vitamin C'],
      ['dragon-fruit', 'دراجون فروت', 'Dragon Fruit'],
    ]),
  },
  {
    slug: 'deep-love-body-oil', sku: 'CAT-DEEP-LOVE-BODY-OIL',
    nameAr: 'زيت عطري Deep Love', nameEn: 'Deep Love Perfumed Body Oil', brand: 'العروسة',
    category: 'زيوت الجسم العطرية', categorySlug: 'perfumed-body-oils',
    shortDescription: 'زيت عطري بروائح فاكهية وحلوة متعددة ضمن منتج واحد.',
    variants: variants('deep-love-body-oil', 2500, [
      ['mango', 'مانجا', 'Mango'], ['candy', 'كاندي', 'Candy'], ['watermelon', 'بطيخ', 'Watermelon'],
      ['tutti-frutti', 'توتي فروتي', 'Tutti Frutti'], ['blueberry', 'توت أزرق', 'Blueberry'],
      ['cherry', 'كرز', 'Cherry'], ['strawberry', 'فراولة', 'Strawberry'],
    ]),
  },
  single('alarousa-facial-scrub', 'مقشر الوجه العروسة', 'Al Arousa Facial Scrub', 'العروسة', 'العناية بالوجه', 'face-care', 2000, 'مقشر للوجه من العروسة.'),
  single('alarousa-moisturizing-face-cream', 'كريم ترطيب الوجه العروسة', 'Al Arousa Moisturizing Face Cream', 'العروسة', 'العناية بالوجه', 'face-care', 2000, 'كريم مرطب للوجه من العروسة.'),
  single('alarousa-natural-rose-water', 'ماء ورد طبيعي العروسة', 'Al Arousa Natural Rose Water', 'العروسة', 'العناية بالوجه', 'face-care', 3000, 'ماء ورد طبيعي للعناية اليومية.'),
  single('alarousa-gazelle-heel-skin-cream', 'كريم كعب الغزال العروسة', 'Al Arousa Gazelle Heel Skin Cream', 'العروسة', 'العناية بالجسم', 'body-care', 3000, 'كريم مخصص للعناية بمناطق الجلد الجافة.'),
  single('alarousa-moroccan-nila-mask', 'ماسك النيلة المغربية العروسة', 'Al Arousa Moroccan Nila Mask', 'العروسة', 'ماسكات الوجه', 'face-masks', 3000, 'ماسك النيلة المغربية من العروسة.'),
  single('alarousa-bikini-butter', 'زبدة البكيني العروسة', 'Al Arousa Bikini Butter', 'العروسة', 'العناية الحساسة', 'intimate-care', 3000, 'زبدة مرطبة للعناية الخارجية بمنطقة البكيني.'),
];

export const catalogVariantCount = catalogBatch78194.reduce((sum, product) => sum + product.variants.length, 0);
