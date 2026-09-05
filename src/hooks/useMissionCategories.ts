import { useCallback, useState } from "react";
import { toastError, setErrorFromCaught } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import type { useMissionsApi } from "@/hooks/useMissionsApi";

type ToastFn = (message: string, type?: "success" | "error" | "info") => void;

/**
 * The category CRUD slice of {@link useMissionsApi}. Picking from the real
 * return type keeps the two in lockstep — a signature change there is a compile
 * error here rather than a silent drift.
 */
type CategoryApi = Pick<
  ReturnType<typeof useMissionsApi>,
  "fetchCategories" | "createCategory" | "updateCategory" | "deleteCategory"
>;

export interface UseMissionCategoriesOptions extends CategoryApi {
  showToast: ToastFn;
  /**
   * Reload the missions + templates slices after a delete. A category delete
   * reassigns its missions to the fallback category, so those slices are stale
   * once the delete lands. Kept as an injected callback (rather than reaching
   * back into the list slice) so this hook stays a self-contained leaf with no
   * cyclic dependency on the composing hook.
   */
  onMissionsReassigned: () => Promise<unknown>;
}

/**
 * Category-management concern extracted from `useMissionsPage`: the category
 * catalog (`categories`), its load-error banner state, the manager-modal
 * visibility, and the load/create/update/delete handlers. The form's *selected*
 * `newCategoryId` deliberately stays in the compose layer — this hook owns the
 * catalog and its CRUD, not the per-mission selection.
 */
export function useMissionCategories({
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  showToast,
  onMissionsReassigned,
}: UseMissionCategoriesOptions) {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(
    null,
  );
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchCategories();
      setCategories(list);
      setCategoriesLoadError(null);
    } catch (error) {
      // Surface to both the inline error banner the page renders and the toast.
      // `setErrorFromCaught` returns the resolved message so the dual dispatch
      // (state + toast) resolves the string once.
      const msg = setErrorFromCaught(
        setCategoriesLoadError,
        error,
        "Failed to load categories",
      );
      showToast(msg, "error");
    }
  }, [fetchCategories, showToast]);

  const handleCreateCategory = useCallback(
    async (name: string, color?: string): Promise<string | null> => {
      try {
        const cat = await createCategory(name, color);
        if (cat?.id) {
          await loadCategories();
          showToast(`Category "${name}" created`, "success");
          return cat.id;
        }
        showToast("Could not create category", "error");
      } catch (error) {
        toastError(showToast, error, "Failed to create category");
      }
      return null;
    },
    [createCategory, loadCategories, showToast],
  );

  // Both writes answer whether they landed. Reloading over a refused write is
  // what made a rejected rename look like a successful one that got reverted
  // (T-0104, D71), so on failure nothing reloads and the caller keeps the
  // editor open with the operator's text still in it.
  const handleUpdateCategory = useCallback(
    async (id: string, patch: { name?: string; color?: string }): Promise<boolean> => {
      const res = await updateCategory(id, patch);
      toastFromResult(showToast, res, "Category updated", "Failed to update category");
      if (!res.ok) return false;
      await loadCategories();
      return true;
    },
    [updateCategory, loadCategories, showToast],
  );

  const handleDeleteCategory = useCallback(
    async (id: string, reassignToId: string | null): Promise<boolean> => {
      try {
        await deleteCategory(id, reassignToId);
      } catch (error) {
        toastError(showToast, error, "Failed to delete category");
        return false;
      }
      showToast("Category deleted", "success");
      // Refresh all three affected slices in parallel: the category catalog
      // (own) plus the missions/templates the delete may have reassigned.
      await Promise.allSettled([loadCategories(), onMissionsReassigned()]);
      return true;
    },
    [deleteCategory, loadCategories, onMissionsReassigned, showToast],
  );

  const openCategoryManager = useCallback(() => setShowCategoryManager(true), []);
  const closeCategoryManager = useCallback(
    () => setShowCategoryManager(false),
    [],
  );

  return {
    categories,
    categoriesLoadError,
    showCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    openCategoryManager,
    closeCategoryManager,
  };
}
