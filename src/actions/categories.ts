'use server';

import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/dal';
import { revalidatePath } from 'next/cache';
import { uploadMedia } from '@/actions/upload';
import { ensureDefaultTaxonomyInstalled } from '@/lib/taxonomy-defaults';

export type CategoryWithChildren = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  parentId: string | null;
  sortOrder: number;
  isVisible: boolean;
  defaultTemplateId: string | null;
  defaultTemplate?: { id: string; nameAr: string; code: string } | null;
  directProductCount: number;
  rollupProductCount: number;
  children: CategoryWithChildren[];
};

export type MoveCategoryPosition = 'inside' | 'before' | 'after';

/**
 * Returns the depth level of a category (1 for root, 2 for subcategory, 3 for sub-sub, etc.)
 * Returns 0 if categoryId is null (the root).
 */
export async function getCategoryLevel(categoryId: string | null): Promise<number> {
  if (!categoryId) return 0;
  let level = 1;
  let currentId: string | null = categoryId;

  while (currentId) {
    const cat: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!cat || !cat.parentId) break;
    level++;
    currentId = cat.parentId;
    if (level > 10) break; // safeguard
  }
  return level;
}

/**
 * Returns the maximum depth of the subtree rooted at categoryId (1 if leaf, 2 if has children, 3 if has grandchildren).
 */
export async function getSubtreeHeight(categoryId: string): Promise<number> {
  const children: { id: string }[] = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  if (children.length === 0) return 1;
  const childHeights = await Promise.all(children.map(c => getSubtreeHeight(c.id)));
  return 1 + Math.max(...childHeights);
}

/**
 * Checks if candidateParentId is a descendant of currentId to prevent circular nesting.
 */
async function isDescendant(candidateParentId: string, currentId: string): Promise<boolean> {
  if (candidateParentId === currentId) return true;
  let currentParentId: string | null = candidateParentId;

  while (currentParentId) {
    const parentCat: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    if (!parentCat) break;
    if (parentCat.parentId === currentId) return true;
    currentParentId = parentCat.parentId;
  }
  return false;
}

export async function createCategory(formData: FormData) {
  await requirePermission('manage:products');

  try {
    const name = String(formData.get('name') || '').trim();
    if (!name) throw new Error('اسم القسم مطلوب');

    const parentId = String(formData.get('parentId') || '').trim() || null;
    const defaultTemplateId = String(formData.get('defaultTemplateId') || '').trim() || null;
    const description = String(formData.get('description') || '').trim() || null;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isVisible = formData.get('isVisible') !== 'false';

    let imagePath: string | null = null;
    const imageFile = formData.get('image');
    if (imageFile instanceof File && imageFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append('file', imageFile);
      uploadData.set('bucket', 'product-images');
      uploadData.set('folder', 'categories');
      const res = await uploadMedia(uploadData);
      if (res.success && res.url) {
        imagePath = res.url;
      } else {
        throw new Error(res.error || 'فشل رفع صورة القسم');
      }
    } else {
      const rawImagePath = String(formData.get('imagePath') || '').trim();
      if (rawImagePath) {
        imagePath = rawImagePath;
      }
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        parentId,
        defaultTemplateId,
        description,
        imagePath,
        sortOrder,
        isVisible,
      },
    });

    const productIds = formData.getAll('productIds') as string[];
    if (productIds && productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId: category.id },
      });
    }

    revalidatePath('/admin/categories');
    revalidatePath('/admin/products');
    revalidatePath('/', 'layout');
    return { success: true, categoryId: category.id };
  } catch (error: unknown) {
    console.error('Error creating category:', error);
    return { success: false, error: error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء القسم' };
  }
}

export async function updateCategory(id: string, formData: FormData) {
  await requirePermission('manage:products');

  try {
    const name = String(formData.get('name') || '').trim();
    if (!name) throw new Error('اسم القسم مطلوب');

    const parentId = String(formData.get('parentId') || '').trim() || null;
    const defaultTemplateId = String(formData.get('defaultTemplateId') || '').trim() || null;
    const description = String(formData.get('description') || '').trim() || null;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isVisible = formData.get('isVisible') !== 'false';

    let imagePath: string | null | undefined = undefined;
    const removeImage = formData.get('removeImage') === 'true';
    if (removeImage) {
      imagePath = null;
    } else {
      const imageFile = formData.get('image');
      if (imageFile instanceof File && imageFile.size > 0) {
        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        uploadData.set('bucket', 'product-images');
        uploadData.set('folder', 'categories');
        const res = await uploadMedia(uploadData);
        if (res.success && res.url) {
          imagePath = res.url;
        } else {
          throw new Error(res.error || 'فشل رفع صورة القسم');
        }
      } else if (formData.has('imagePath')) {
        const rawImagePath = String(formData.get('imagePath') || '').trim();
        imagePath = rawImagePath || null;
      }
    }

    // Anti-cyclic nesting validation
    if (parentId) {
      if (parentId === id) {
        throw new Error('لا يمكن للقسم أن يكون قسماً فرعياً لنفسه.');
      }
      const isCycle = await isDescendant(parentId, id);
      if (isCycle) {
        throw new Error('لا يمكن نقل القسم ليكون فرعاً لأحد الأقسام التابعة له.');
      }
    }

    await prisma.category.update({
      where: { id },
      data: {
        name,
        parentId,
        defaultTemplateId,
        description,
        sortOrder,
        isVisible,
        ...(imagePath !== undefined ? { imagePath } : {}),
      },
    });

    const productIds = formData.getAll('productIds') as string[];
    if (productIds && productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId: id },
      });
    }

    revalidatePath('/admin/categories');
    revalidatePath('/admin/products');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating category:', error);
    return { success: false, error: error instanceof Error ? error.message : 'حدث خطأ أثناء تعديل القسم' };
  }
}

export async function toggleCategoryVisibility(id: string, isVisible: boolean) {
  await requirePermission('manage:products');
  try {
    await prisma.category.update({
      where: { id },
      data: { isVisible },
    });
    revalidatePath('/admin/categories');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'تعذر تغيير حالة الظهور' };
  }
}

export async function deleteCategory(id: string, deleteProducts: boolean, fallbackCategoryId?: string) {
  await requirePermission('manage:products');

  try {
    if (deleteProducts) {
      await prisma.product.deleteMany({
        where: { categoryId: id },
      });
    } else {
      if (!fallbackCategoryId) {
        throw new Error('يجب اختيار قسم بديل لنقل المنتجات إليه');
      }
      if (fallbackCategoryId === id) {
        throw new Error('لا يمكن نقل المنتجات إلى نفس القسم المحذوف');
      }
      await prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: fallbackCategoryId },
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    revalidatePath('/admin/categories');
    revalidatePath('/admin/products');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting category:', error);
    return { success: false, error: error instanceof Error ? error.message : 'حدث خطأ أثناء الحذف' };
  }
}

/**
 * Move or reorder a category:
 * - position === 'inside': moves category to become a child of targetId.
 * - position === 'before' | 'after': reorders category relative to targetId as a sibling.
 * - targetId === null: moves category to the root level.
 */
export async function moveCategory(
  categoryId: string,
  targetId: string | null,
  position: MoveCategoryPosition = 'inside'
) {
  await requirePermission('manage:products');

  try {
    if (!categoryId) {
      throw new Error('معرف القسم المراد نقله مطلوب');
    }

    const moving = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, parentId: true, sortOrder: true },
    });
    if (!moving) {
      throw new Error('القسم المراد نقله غير موجود');
    }

    // Moving to root level
    if (!targetId) {
      const rootSiblings = await prisma.category.findMany({
        where: { parentId: null, id: { not: categoryId } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, sortOrder: true },
      });
      const maxSortOrder = rootSiblings.length > 0 ? Math.max(...rootSiblings.map(s => s.sortOrder)) : 0;

      await prisma.category.update({
        where: { id: categoryId },
        data: {
          parentId: null,
          sortOrder: maxSortOrder + 10,
        },
      });

      revalidatePath('/admin/categories');
      revalidatePath('/admin/products');
      revalidatePath('/', 'layout');
      return { success: true, message: `تم نقل "${moving.name}" إلى المستوى الرئيسي` };
    }

    if (targetId === categoryId) {
      throw new Error('لا يمكن نقل القسم إلى نفسه');
    }

    const target = await prisma.category.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, parentId: true, sortOrder: true },
    });
    if (!target) {
      throw new Error('القسم المستهدف غير موجود');
    }

    const newParentId = position === 'inside' ? targetId : target.parentId;

    // Prevent circular hierarchy
    if (newParentId) {
      if (newParentId === categoryId) {
        throw new Error('لا يمكن للقسم أن يكون فرعاً لنفسه');
      }
      const isCycle = await isDescendant(newParentId, categoryId);
      if (isCycle) {
        throw new Error('لا يمكن نقل القسم ليكون فرعاً لأحد الأقسام التابعة له');
      }
    }

    // Check maximum tree depth (max 3 levels)
    const targetParentLevel = await getCategoryLevel(newParentId);
    const catSubtreeHeight = await getSubtreeHeight(categoryId);
    const resultingDepth = targetParentLevel + catSubtreeHeight;

    if (resultingDepth > 3) {
      throw new Error(
        `لا يمكن النقل: يتجاوز الهيكل الحد الأقصى المسموح به (3 مستويات). المستوى الناتج سيكون ${resultingDepth}.`
      );
    }

    if (position === 'inside') {
      const siblings = await prisma.category.findMany({
        where: { parentId: newParentId, id: { not: categoryId } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, sortOrder: true },
      });
      const maxSortOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sortOrder)) : 0;

      await prisma.category.update({
        where: { id: categoryId },
        data: {
          parentId: newParentId,
          sortOrder: maxSortOrder + 10,
        },
      });
    } else {
      // position === 'before' || position === 'after'
      const siblings = await prisma.category.findMany({
        where: { parentId: newParentId, id: { not: categoryId } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true },
      });

      const targetIndex = siblings.findIndex(s => s.id === targetId);
      const insertIndex = position === 'before' ? Math.max(0, targetIndex) : targetIndex + 1;

      siblings.splice(insertIndex, 0, { id: categoryId });

      for (const [idx, item] of siblings.entries()) {
        await prisma.category.update({
          where: { id: item.id },
          data: {
            parentId: newParentId,
            sortOrder: idx * 10,
          },
        });
      }
    }

    revalidatePath('/admin/categories');
    revalidatePath('/admin/products');
    revalidatePath('/', 'layout');
    return { success: true, message: `تم نقل وترتيب القسم "${moving.name}" بنجاح` };
  } catch (error: unknown) {
    console.error('Error moving category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'حدث خطأ أثناء نقل القسم',
    };
  }
}

/**
 * Returns full hierarchical categories with recursive rollup product counts.
 */
export async function getCategoryTree(): Promise<CategoryWithChildren[]> {
  const all = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
      defaultTemplate: { select: { id: true, nameAr: true, code: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const nodeMap = new Map<string, CategoryWithChildren>();

  for (const cat of all) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imagePath: cat.imagePath,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      isVisible: cat.isVisible,
      defaultTemplateId: cat.defaultTemplateId,
      defaultTemplate: cat.defaultTemplate,
      directProductCount: cat._count.products,
      rollupProductCount: cat._count.products,
      children: [],
    });
  }

  const roots: CategoryWithChildren[] = [];

  for (const cat of all) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parentId && nodeMap.has(cat.parentId)) {
      const parent = nodeMap.get(cat.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Calculate cumulative rollup product count
  function calculateRollup(node: CategoryWithChildren): number {
    let count = node.directProductCount;
    for (const child of node.children) {
      count += calculateRollup(child);
    }
    node.rollupProductCount = count;
    return count;
  }

  for (const root of roots) {
    calculateRollup(root);
  }

  return roots;
}

export async function initRawaqTaxonomyAction() {
  await requirePermission('manage:products');
  await ensureDefaultTaxonomyInstalled();
  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  revalidatePath('/', 'layout');
  return { success: true };
}
