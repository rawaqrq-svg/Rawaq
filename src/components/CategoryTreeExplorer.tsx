'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
  initRawaqTaxonomyAction,
  moveCategory,
  type CategoryWithChildren,
  type MoveCategoryPosition,
} from '@/actions/categories';
import {
  GripVertical,
  FolderInput,
  Move,
  CheckCircle2,
  AlertCircle,
  Info,
  Plus,
  Edit3,
  Trash2,
  ArrowUpDown,
  Search,
} from 'lucide-react';

interface CategoryTreeExplorerProps {
  tree: CategoryWithChildren[];
  flatCategories: { id: string; name: string; parentId: string | null; slug: string }[];
  templates: { id: string; code: string; nameAr: string }[];
}

export function CategoryTreeExplorer({
  tree,
  flatCategories,
  templates,
}: CategoryTreeExplorerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search filter & collapse state
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Notification banner state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Drag and drop states
  const [draggedNode, setDraggedNode] = useState<CategoryWithChildren | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);
  const [isOverRootZone, setIsOverRootZone] = useState(false);

  // Quick move modal state (for mobile / accessible fallback)
  const [quickMoveCategory, setQuickMoveCategory] = useState<CategoryWithChildren | null>(null);
  const [quickMoveTargetId, setQuickMoveTargetId] = useState<string>('ROOT');

  // Modal states (Create / Edit)
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryWithChildren | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formDefaultTemplateId, setFormDefaultTemplateId] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');
  const [formImagePath, setFormImagePath] = useState<string>('');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formIsVisible, setFormIsVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithChildren | null>(null);
  const [fallbackId, setFallbackId] = useState<string>('');

  // Compute category levels map for instant validation and labels
  const categoryLevelMap = useMemo(() => {
    const map = new Map<string, number>();
    function traverse(nodes: CategoryWithChildren[], lvl: number) {
      for (const n of nodes) {
        map.set(n.id, lvl);
        if (n.children && n.children.length > 0) {
          traverse(n.children, lvl + 1);
        }
      }
    }
    traverse(tree, 1);
    return map;
  }, [tree]);

  function getSubtreeHeight(node: CategoryWithChildren): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getSubtreeHeight));
  }

  function isDescendant(candidateId: string, node: CategoryWithChildren): boolean {
    if (candidateId === node.id) return true;
    if (!node.children) return false;
    for (const child of node.children) {
      if (isDescendant(candidateId, child)) return true;
    }
    return false;
  }

  function canDropInside(
    targetNode: CategoryWithChildren,
    targetLevel: number,
    movingNode: CategoryWithChildren
  ): { allowed: boolean; reason?: string } {
    if (movingNode.id === targetNode.id) {
      return { allowed: false, reason: 'لا يمكن نقل القسم إلى نفسه' };
    }
    if (isDescendant(targetNode.id, movingNode)) {
      return { allowed: false, reason: 'لا يمكن نقله ليكون فرعاً لأحد الأقسام التابعة له' };
    }
    if (targetLevel >= 3) {
      return { allowed: false, reason: 'القسم في المستوى الأخير (3) ولا يمكن إضافة فروع تحته' };
    }
    const movingHeight = getSubtreeHeight(movingNode);
    if (targetLevel + movingHeight > 3) {
      return {
        allowed: false,
        reason: `سيتجاوز الحد الأقصى للهيكل (3 مستويات). المستوى الناتج سيكون ${targetLevel + movingHeight}.`,
      };
    }
    return { allowed: true };
  }

  function canDropRelative(
    targetNode: CategoryWithChildren,
    targetLevel: number,
    movingNode: CategoryWithChildren
  ): { allowed: boolean; reason?: string } {
    if (movingNode.id === targetNode.id) {
      return { allowed: false, reason: 'نفس القسم' };
    }
    if (isDescendant(targetNode.id, movingNode)) {
      return { allowed: false, reason: 'لا يمكن الترتيب بالنسبة لقسم تابع' };
    }
    const parentLevel = targetLevel - 1; // 0 if target is root
    const movingHeight = getSubtreeHeight(movingNode);
    if (parentLevel + movingHeight > 3) {
      return {
        allowed: false,
        reason: `سيتجاوز الحد الأقصى للهيكل (3 مستويات). المستوى الناتج سيكون ${parentLevel + movingHeight}.`,
      };
    }
    return { allowed: true };
  }

  function toggleCollapse(id: string) {
    setCollapsedNodes(curr => ({ ...curr, [id]: !curr[id] }));
  }

  function expandAll() {
    setCollapsedNodes({});
  }

  function collapseAll() {
    const allIds: Record<string, boolean> = {};
    function collect(nodes: CategoryWithChildren[]) {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          allIds[n.id] = true;
          collect(n.children);
        }
      }
    }
    collect(tree);
    setCollapsedNodes(allIds);
  }

  function openCreate(parentId: string | null = null) {
    setModalMode('CREATE');
    setEditingCategory(null);
    setTargetParentId(parentId);
    setFormName('');
    setFormParentId(parentId || '');
    setFormDefaultTemplateId('');
    setFormDescription('');
    setFormImagePath('');
    setFormImageFile(null);
    setImagePreview(null);
    setFormIsVisible(true);
    setErrorMessage('');
  }

  function openEdit(cat: CategoryWithChildren) {
    setModalMode('EDIT');
    setEditingCategory(cat);
    setTargetParentId(null);
    setFormName(cat.name);
    setFormParentId(cat.parentId || '');
    setFormDefaultTemplateId(cat.defaultTemplateId || '');
    setFormDescription(cat.description || '');
    setFormImagePath(cat.imagePath || '');
    setFormImageFile(null);
    setImagePreview(cat.imagePath || null);
    setFormIsVisible(cat.isVisible);
    setErrorMessage('');
  }

  function openQuickMove(cat: CategoryWithChildren) {
    setQuickMoveCategory(cat);
    setQuickMoveTargetId(cat.parentId || 'ROOT');
  }

  function closeModal() {
    setModalMode(null);
    setEditingCategory(null);
    setTargetParentId(null);
    setErrorMessage('');
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    const formData = new FormData();
    formData.set('name', formName.trim());
    formData.set('parentId', formParentId);
    formData.set('defaultTemplateId', formDefaultTemplateId);
    formData.set('description', formDescription.trim());
    formData.set('isVisible', String(formIsVisible));
    if (formImageFile) {
      formData.append('image', formImageFile);
    } else if (formImagePath) {
      formData.set('imagePath', formImagePath.trim());
    } else {
      formData.set('removeImage', 'true');
    }

    startTransition(async () => {
      let res;
      if (modalMode === 'EDIT' && editingCategory) {
        res = await updateCategory(editingCategory.id, formData);
      } else {
        res = await createCategory(formData);
      }

      if (!res.success) {
        setErrorMessage(res.error || 'فشلت العملية.');
      } else {
        closeModal();
        router.refresh();
      }
    });
  }

  async function handleToggleVisibility(id: string, current: boolean) {
    startTransition(async () => {
      await toggleCategoryVisibility(id, !current);
      router.refresh();
    });
  }

  async function handleDelete(deleteProducts: boolean) {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCategory(deleteTarget.id, deleteProducts, fallbackId || undefined);
      if (!res.success) {
        alert(res.error || 'تعذر الحذف');
      } else {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  async function handleSeedTaxonomy() {
    if (!confirm('هل تريد تثبيت شجرة الأقسام الافتراضية لمتجر رَواق (المكياج، الأزياء، العطور، العناية، الهدايا، الإكسسوارات)؟')) return;
    startTransition(async () => {
      await initRawaqTaxonomyAction();
      router.refresh();
    });
  }

  // Execute Move server action
  async function executeMove(
    categoryId: string,
    targetId: string | null,
    pos: MoveCategoryPosition = 'inside'
  ) {
    setNotification({ type: 'info', message: 'جارِ نقل وترتيب القسم...' });
    startTransition(async () => {
      const res = await moveCategory(categoryId, targetId, pos);
      if (res.success) {
        setNotification({
          type: 'success',
          message: res.message || 'تم نقل وترتيب القسم بنجاح!',
        });
        router.refresh();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'تعذر نقل القسم.',
        });
      }
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    });
  }

  // Drag Event Handlers
  function handleDragStart(e: React.DragEvent, node: CategoryWithChildren) {
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNode(node);
  }

  function handleDragEnd() {
    setDraggedNode(null);
    setDropTargetId(null);
    setDropPosition(null);
    setIsOverRootZone(false);
  }

  function handleDragOver(e: React.DragEvent, node: CategoryWithChildren, level: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode || draggedNode.id === node.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const ratio = offsetY / rect.height;

    let pos: 'before' | 'after' | 'inside';
    if (ratio < 0.25) {
      pos = 'before';
    } else if (ratio > 0.75) {
      pos = 'after';
    } else {
      pos = 'inside';
    }

    if (dropTargetId !== node.id || dropPosition !== pos) {
      setDropTargetId(node.id);
      setDropPosition(pos);
    }
  }

  function handleDragLeave(e: React.DragEvent, node: CategoryWithChildren) {
    const related = e.relatedTarget as Node | null;
    if (e.currentTarget.contains(related)) return;
    if (dropTargetId === node.id) {
      setDropTargetId(null);
      setDropPosition(null);
    }
  }

  function handleDrop(e: React.DragEvent, node: CategoryWithChildren, level: number) {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || draggedNode.id === node.id || !dropPosition) {
      handleDragEnd();
      return;
    }

    // Validate drop permissions
    if (dropPosition === 'inside') {
      const check = canDropInside(node, level, draggedNode);
      if (!check.allowed) {
        setNotification({ type: 'error', message: check.reason || 'لا يمكن نقل القسم إلى هذا المكان' });
        handleDragEnd();
        return;
      }
    } else {
      const check = canDropRelative(node, level, draggedNode);
      if (!check.allowed) {
        setNotification({ type: 'error', message: check.reason || 'لا يمكن نقل القسم إلى هذا المكان' });
        handleDragEnd();
        return;
      }
    }

    const movingId = draggedNode.id;
    const targetId = node.id;
    const pos = dropPosition;

    handleDragEnd();
    executeMove(movingId, targetId, pos);
  }

  function handleDropOnRoot(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode) return;

    if (!draggedNode.parentId) {
      setNotification({ type: 'info', message: 'القسم موجود بالفعل في المستوى الرئيسي.' });
      handleDragEnd();
      return;
    }

    const movingId = draggedNode.id;
    handleDragEnd();
    executeMove(movingId, null, 'inside');
  }

  function nodeMatchesSearch(node: CategoryWithChildren, term: string): boolean {
    if (!term) return true;
    if (node.name.toLowerCase().includes(term.toLowerCase())) return true;
    if (node.slug.toLowerCase().includes(term.toLowerCase())) return true;
    return node.children.some(child => nodeMatchesSearch(child, term));
  }

  // Eligible parents for quick move modal
  const eligibleQuickMoveParents = useMemo(() => {
    if (!quickMoveCategory) return [];
    return flatCategories.filter(c => {
      if (c.id === quickMoveCategory.id) return false;
      if (isDescendant(c.id, quickMoveCategory)) return false;
      const parentLvl = categoryLevelMap.get(c.id) || 1;
      if (parentLvl >= 3) return false;
      const movingHeight = getSubtreeHeight(quickMoveCategory);
      if (parentLvl + movingHeight > 3) return false;
      return true;
    });
  }, [quickMoveCategory, flatCategories, categoryLevelMap]);

  // Recursive render of category tree
  function renderNode(node: CategoryWithChildren, level: number = 1) {
    if (searchTerm && !nodeMatchesSearch(node, searchTerm)) {
      return null;
    }

    const isCollapsed = Boolean(collapsedNodes[node.id]);
    const hasChildren = node.children && node.children.length > 0;
    const isDraggingCurrent = draggedNode?.id === node.id;
    const isDropTarget = dropTargetId === node.id;
    const isDropBefore = isDropTarget && dropPosition === 'before';
    const isDropAfter = isDropTarget && dropPosition === 'after';
    const isDropInside = isDropTarget && dropPosition === 'inside';

    let dropInsideValidity: { allowed: boolean; reason?: string } = { allowed: true };
    if (isDropInside && draggedNode) {
      dropInsideValidity = canDropInside(node, level, draggedNode);
    }

    const levelBadge =
      level === 1
        ? { text: 'مستوى 1 رئيسي', bg: 'bg-[#3F4832]/10 text-[#3F4832]' }
        : level === 2
        ? { text: 'مستوى 2 فرعي', bg: 'bg-amber-100 text-amber-900' }
        : { text: 'مستوى 3 تخصصي', bg: 'bg-blue-100 text-blue-900' };

    return (
      <div key={node.id} className="space-y-1.5 transition-all">
        {/* Drop Insertion Line (Before) */}
        {isDropBefore && (
          <div
            className="h-2.5 w-full bg-[#3F4832] rounded-full my-1.5 animate-pulse flex items-center justify-center shadow-md"
            style={{ marginInlineStart: `${(level - 1) * 24}px` }}
          >
            <span className="text-[10px] bg-[#3F4832] text-white px-3 py-0.5 rounded-full font-bold shadow">
              ↑ إفلات للترتيب قبل &quot;{node.name}&quot;
            </span>
          </div>
        )}

        <div
          draggable={!isPending}
          onDragStart={e => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(e, node, level)}
          onDragLeave={e => handleDragLeave(e, node)}
          onDrop={e => handleDrop(e, node, level)}
          className={`group flex flex-wrap items-center justify-between p-3.5 rounded-2xl border transition-all select-none ${
            isDraggingCurrent
              ? 'opacity-40 border-dashed border-[#3F4832] bg-[#3F4832]/5 scale-[0.99]'
              : isDropInside
              ? dropInsideValidity.allowed
                ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-300 shadow-md'
                : 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-200'
              : !node.isVisible
              ? 'bg-zinc-100/60 border-zinc-200 text-zinc-400'
              : level === 1
              ? 'bg-white border-zinc-200 shadow-sm hover:border-[#3F4832]/40 hover:shadow'
              : level === 2
              ? 'bg-zinc-50/80 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
              : 'bg-white border-dashed border-zinc-200 hover:border-zinc-300'
          }`}
          style={{ marginInlineStart: `${(level - 1) * 24}px` }}
        >
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div
              className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0 group-hover:text-[#3F4832]"
              title="اضغط مع السحب لنقل القسم أو إعادة ترتيبه"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 transition-transform"
                title={isCollapsed ? 'توسيع الفروع' : 'طي الفروع'}
              >
                {isCollapsed ? '+' : '−'}
              </button>
            ) : (
              <span className="w-7 text-center text-zinc-300 text-xs">●</span>
            )}

            {node.imagePath ? (
              <img
                src={node.imagePath}
                alt={node.name}
                className="w-10 h-10 rounded-xl object-cover border border-zinc-200 shrink-0"
              />
            ) : null}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-zinc-900">{node.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelBadge.bg}`}>
                  {levelBadge.text}
                </span>

                {!node.isVisible && (
                  <span className="text-[10px] font-bold bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                    مخفي من المتجر 👁️‍🗨️
                  </span>
                )}

                {node.defaultTemplate && (
                  <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span>قالب:</span>
                    <span>{node.defaultTemplate.nameAr}</span>
                  </span>
                )}

                {/* Drop inside indicator badge */}
                {isDropInside && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm animate-pulse flex items-center gap-1 ${
                      dropInsideValidity.allowed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {dropInsideValidity.allowed ? (
                      <>
                        <span>↳ إفلات ليصبح فرعاً داخل {node.name} (مستوى {level + 1})</span>
                      </>
                    ) : (
                      <>
                        <span>⛔ {dropInsideValidity.reason}</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-400 font-mono">
                <span>slug: {node.slug}</span>
                <span>•</span>
                <span className="text-zinc-600 font-sans">
                  {node.directProductCount} منتج مباشر (الإجمالي مع الفروع: {node.rollupProductCount})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            {level < 3 && (
              <button
                type="button"
                onClick={() => openCreate(node.id)}
                className="text-xs font-bold text-[#3F4832] bg-[#3F4832]/10 hover:bg-[#3F4832]/20 px-3 py-1.5 rounded-xl transition-colors"
                title="إضافة قسم فرعي تحت هذا القسم"
              >
                + فرعي
              </button>
            )}

            <button
              type="button"
              onClick={() => handleToggleVisibility(node.id, node.isVisible)}
              className={`text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
                node.isVisible
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200'
              }`}
              title={node.isVisible ? 'إخفاء من المتجر' : 'إظهار في المتجر'}
            >
              {node.isVisible ? 'ظاهر 🟢' : 'مخفي ⚪'}
            </button>

            {/* Quick Move Button (Accessibility & Mobile) */}
            <button
              type="button"
              onClick={() => openQuickMove(node)}
              className="text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
              title="نقل القسم إلى قسم آخر أو للمستوى الرئيسي"
            >
              <Move className="w-3.5 h-3.5" />
              <span>نقل</span>
            </button>

            <button
              type="button"
              onClick={() => openEdit(node)}
              className="text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              تعديل ✏️
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteTarget(node);
                setFallbackId('');
              }}
              className="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-xl transition-colors"
              title="حذف القسم"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Drop Insertion Line (After) */}
        {isDropAfter && (
          <div
            className="h-2.5 w-full bg-[#3F4832] rounded-full my-1.5 animate-pulse flex items-center justify-center shadow-md"
            style={{ marginInlineStart: `${(level - 1) * 24}px` }}
          >
            <span className="text-[10px] bg-[#3F4832] text-white px-3 py-0.5 rounded-full font-bold shadow">
              ↓ إفلات للترتيب بعد &quot;{node.name}&quot;
            </span>
          </div>
        )}

        {/* Children Render */}
        {hasChildren && !isCollapsed && (
          <div className="border-inline-start-2 border-zinc-200/80 ps-2 space-y-1.5 mt-1.5 ms-3">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Helper Banner */}
      <div className="p-4 rounded-3xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-900 rounded-xl shrink-0">
          <FolderInput className="w-5 h-5" />
        </div>
        <div className="text-xs text-amber-950 space-y-1">
          <h4 className="font-bold text-sm">ميزة سحب وإفلات الأقسام الهرمية (Drag & Drop) مفعلة ✨</h4>
          <p className="leading-relaxed text-amber-900/90">
            يمكنك الآن بكل سهولة الإمساك بأي قسم وسحبه:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-medium text-[11px]">
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200/60">
              <span className="font-bold block text-emerald-800 mb-0.5">↳ نقل كقسم فرعي:</span>
              اسحب القسم وأفلته في منتصف القسم المراد ليصبح فرعاً له تلقائياً.
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200/60">
              <span className="font-bold block text-blue-800 mb-0.5">↕ إعادة الترتيب:</span>
              اسحب القسم لأعلى أو لأسفل قسم آخر لإعادة ترتيب ظهوره بالمتجر.
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200/60">
              <span className="font-bold block text-purple-800 mb-0.5">⭐ تحويل لقسم رئيسي:</span>
              اسحب القسم وأفلته في &quot;منطقة المستوى الرئيسي&quot; بالأعلى لجعله مستقلاً (Level 1).
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-sm transition-all animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="بحث في شجرة الأقسام..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 ps-9 pe-4 py-2 text-xs outline-none focus:border-[#3F4832] bg-zinc-50"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={expandAll}
            className="text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition-colors"
          >
            توسيع الكل ⊞
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition-colors"
          >
            طي الكل ⊟
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSeedTaxonomy}
            className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            ⚡ استيراد شجرة رَواق القياسية
          </button>
          <button
            type="button"
            onClick={() => openCreate(null)}
            className="text-xs font-bold text-white bg-[#3F4832] hover:bg-[#2d3623] px-5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            + قسم رئيسي جديد
          </button>
        </div>
      </div>

      {/* Root Drop Zone: Active when dragging */}
      {draggedNode && (
        <div
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsOverRootZone(true);
          }}
          onDragLeave={() => setIsOverRootZone(false)}
          onDrop={handleDropOnRoot}
          className={`p-5 rounded-3xl border-2 border-dashed transition-all text-center flex items-center justify-center gap-3 animate-in fade-in duration-200 ${
            isOverRootZone
              ? 'border-[#3F4832] bg-[#3F4832]/10 text-[#3F4832] shadow-lg scale-[1.01]'
              : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-[#3F4832]'
          }`}
        >
          <FolderInput className={`w-6 h-6 ${isOverRootZone ? 'text-[#3F4832]' : 'text-zinc-400'}`} />
          <div>
            <span className="text-xs font-bold block">
              📥 إفلات هنا لتحويل القسم &quot;{draggedNode.name}&quot; إلى قسم رئيسي (المستوى 1 بدون أب)
            </span>
            <span className="text-[11px] text-zinc-400">
              سيصبح قسماً مستقلاً في أعلى هيكل شجرة الأقسام
            </span>
          </div>
        </div>
      )}

      {/* Tree View Display */}
      {tree.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-zinc-300 shadow-sm">
          <span className="text-4xl block mb-3">🗂️</span>
          <h3 className="font-bold text-base text-zinc-800">لا توجد أقسام مسجلة في شجرة الكتالوج بعد</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            يمكنك إنشاء قسم رئيسي جديد، أو تثبيت شجرة أقسام رَواق القياسية بضغطة زر واحدة لإنشاء شجرة المكياج والأزياء والعطور والعناية تلقائياً.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSeedTaxonomy}
            className="mt-4 px-6 py-2.5 bg-[#3F4832] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#2d3623]"
          >
            ⚡ تثبيت شجرة أقسام رَواق الجاهزة الآن
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm space-y-3">
          {tree.map(rootNode => renderNode(rootNode, 1))}
        </div>
      )}

      {/* Modal: Quick Move (Accessible & Mobile-friendly) */}
      {quickMoveCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#3F4832]/10 text-[#3F4832] rounded-xl">
                  <Move className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    نقل القسم: {quickMoveCategory.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    تغيير موقع القسم في الهيكل الشجري للمتجر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickMoveCategory(null)}
                className="text-zinc-400 hover:text-zinc-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  الموقع الجديد للقسم:
                </label>
                <select
                  value={quickMoveTargetId}
                  onChange={e => setQuickMoveTargetId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-[#3F4832] bg-white font-medium"
                >
                  <option value="ROOT">⭐ المستوى الرئيسي (Level 1 بدون أب)</option>
                  <optgroup label="الأقسام المتاحة للنقل داخلها:">
                    {eligibleQuickMoveParents.map(c => {
                      const lvl = categoryLevelMap.get(c.id) || 1;
                      return (
                        <option key={c.id} value={c.id}>
                          {lvl === 1 ? '📁 ' : '↳ '}
                          {c.name} (مستوى {lvl})
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">
                  ملاحظة: تظهر فقط الأقسام المسموح النقل إليها وفق الحد الأقصى (3 مستويات) وبدون تكرار حلقي.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setQuickMoveCategory(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-zinc-600 hover:bg-zinc-100"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const target = quickMoveTargetId === 'ROOT' ? null : quickMoveTargetId;
                    const catId = quickMoveCategory.id;
                    setQuickMoveCategory(null);
                    executeMove(catId, target, 'inside');
                  }}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-[#3F4832] hover:bg-[#2d3623] shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جارِ النقل...' : 'تأكيد النقل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Category */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">
                {modalMode === 'EDIT' ? `تعديل القسم: ${editingCategory?.name}` : 'إضافة قسم جديد'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="my-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  اسم القسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="مثال: أحمر شفاه، عبايات مناسبات، دهن عود"
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-[#3F4832]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">القسم الأب (Parent Category)</label>
                <select
                  value={formParentId}
                  onChange={e => setFormParentId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-[#3F4832] bg-white font-medium"
                >
                  <option value="">-- بدون أب (قسم رئيسي Level 1) --</option>
                  {flatCategories
                    .filter(c => (editingCategory ? c.id !== editingCategory.id : true))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  القالب الافتراضي المرتبط (Default Product Template)
                </label>
                <select
                  value={formDefaultTemplateId}
                  onChange={e => setFormDefaultTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-[#3F4832] bg-white font-medium"
                >
                  <option value="">-- بدون قالب محدد أو يرث من الأب --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr} ({t.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">
                  عند اختيار الموظف لهذا الصنف أثناء إضافة منتج، سيتم تحميل حقول هذا القالب تلقائياً!
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">وصف القسم (اختياري)</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="موجز عن المنتجات التي يشملها هذا القسم..."
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-[#3F4832]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">صورة القسم (Cover Image)</label>
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-zinc-200 shrink-0 bg-zinc-100">
                      <img src={imagePreview} alt="معاينة" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setFormImagePath('');
                          setFormImageFile(null);
                        }}
                        className="absolute top-1 start-1 bg-black/60 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-black"
                        title="إزالة الصورة"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="block w-full text-xs text-zinc-500 file:me-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3F4832]/10 file:text-[#3F4832] hover:file:bg-[#3F4832]/20 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formImagePath}
                      onChange={e => {
                        setFormImagePath(e.target.value);
                        setImagePreview(e.target.value.trim() || null);
                      }}
                      placeholder="أو أدخلي رابط/مسار الصورة (مثال: /images/categories/makeup.jpg)"
                      className="w-full rounded-xl border border-zinc-200 p-2 text-[11px] outline-none focus:border-[#3F4832]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <input
                  type="checkbox"
                  id="formIsVisible"
                  checked={formIsVisible}
                  onChange={e => setFormIsVisible(e.target.checked)}
                  className="w-4 h-4 text-[#3F4832] rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="formIsVisible" className="text-xs font-bold text-zinc-700 cursor-pointer">
                  تفعيل ظهور هذا القسم في متجر رَواق للعملاء
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-zinc-600 hover:bg-zinc-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-[#3F4832] hover:bg-[#2d3623] shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جارِ الحفظ...' : modalMode === 'EDIT' ? 'حفظ التعديلات' : 'إضافة القسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Category */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-red-100 max-w-md w-full p-6 animate-in fade-in">
            <div className="text-3xl mb-2 text-red-500">🗑️</div>
            <h3 className="font-bold text-lg text-zinc-900">حذف القسم: {deleteTarget.name}</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              هذا القسم يحتوي على {deleteTarget.directProductCount} منتج مباشر. اختر ماذا تريد أن تفعل بالمنتجات التابعة له:
            </p>

            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  نقل المنتجات إلى قسم بديل:
                </label>
                <select
                  value={fallbackId}
                  onChange={e => setFallbackId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none bg-white"
                >
                  <option value="">-- اختر القسم البديل --</option>
                  {flatCategories
                    .filter(c => c.id !== deleteTarget.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-zinc-600 hover:bg-zinc-100"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!fallbackId || isPending}
                  onClick={() => handleDelete(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  نقل المنتجات وحذف القسم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
