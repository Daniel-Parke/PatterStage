"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setErrorFromCaught } from "@/lib/api/api-fetch";
import { runWrite } from "@/lib/api/api-write";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";

type ToastFn = (message: string, type?: "success" | "error" | "info") => void;

export interface UseMissionCategoriesOptions {
  fetchCategories: (afterWrite?: boolean) => Promise<ManagedCategory[]>;
  showToast: ToastFn;
  onMissionsReassigned: () => Promise<unknown>;
}

/**
 * The mission categories: the catalogue, the manager modal, and the three
 * writes. A write says what happened and reloads the catalogue; a delete
 * also reloads the missions and templates it may have reassigned.
 */
export function useMissionCategories({
  fetchCategories,
  showToast,
  onMissionsReassigned,
}: UseMissionCategoriesOptions) {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(
    null,
  );
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);

  const loadCategories = useCallback(async (afterWrite = false) => {
    const request = ++version.current;
    try {
      const list = await fetchCategories(afterWrite);
      if (request !== version.current) return;
      setCategories(list);
      setCategoriesLoadError(null);
    } catch (error) {
      if (request !== version.current) return;
      setErrorFromCaught(
        setCategoriesLoadError,
        error,
        "Failed to load categories",
      );
    }
  }, [fetchCategories]);

  const handleCreateCategory = useCallback(
    async (name: string, color?: string): Promise<string | null> => {
      const res = await runWrite<{ data?: { category?: { id: string } } }>({
        showToast,
        url: "/api/mission-categories",
        body: { name, color },
        successMessage: `Category "${name}" created`,
        errorMessage: "Failed to create category",
        onSuccess: () => loadCategories(true),
      });
      return res?.data?.category?.id ?? null;
    },
    [loadCategories, showToast],
  );

  const handleUpdateCategory = useCallback(
    async (id: string, patch: { name?: string; color?: string }): Promise<boolean> => {
      const res = await runWrite({
        showToast,
        url: "/api/mission-categories",
        method: "PUT",
        body: { id, ...patch },
        successMessage: "Category updated",
        errorMessage: "Failed to update category",
        onSuccess: () => loadCategories(true),
      });
      return res !== undefined;
    },
    [loadCategories, showToast],
  );

  const handleDeleteCategory = useCallback(
    async (id: string, reassignToId: string | null): Promise<boolean> => {
      // Always sent, so an explicit Uncategorized reaches the route's null branch.
      const params = new URLSearchParams({ id, reassignToId: reassignToId ?? "" });
      const res = await runWrite({
        showToast,
        url: `/api/mission-categories?${params.toString()}`,
        method: "DELETE",
        successMessage: "Category deleted",
        errorMessage: "Failed to delete category",
        // The catalogue, and the missions and templates the delete may have
        // moved, in parallel.
        onSuccess: async () => {
          await Promise.allSettled([loadCategories(true), onMissionsReassigned()]);
        },
      });
      return res !== undefined;
    },
    [loadCategories, onMissionsReassigned, showToast],
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
