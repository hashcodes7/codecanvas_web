import { useState, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants';
import { ProjectStorage } from '../storage';
import type { CanvasManifestItem, CanvasProperties } from '../types';

export const useProjectManager = () => {
    const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID) || 'project-1';
    });

    const [manifest, setManifest] = useState<CanvasManifestItem[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.MANIFEST);
        if (!saved) {
            const initialManifest = [{ id: 'project-1', name: 'Main Canvas', lastModified: new Date().toISOString() }];
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(initialManifest));
            localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, 'project-1');
            return initialManifest;
        }
        return JSON.parse(saved);
    });

    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

    const switchProject = useCallback((projectId: string) => {
        setCurrentProjectId(projectId);
        localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, projectId);
    }, []);

    const createProject = useCallback(async () => {
        const newId = `project-${Date.now()}`;
        const newProject: CanvasManifestItem = {
            id: newId,
            name: 'Untitled Canvas',
            lastModified: new Date().toISOString()
        };

        // Initialize EMPTY storage for the new project FIRST
        const initialProps: CanvasProperties = {
            backgroundPattern: 'grid',
            backgroundOpacity: 0.7,
            theme: 'dark',
            syntaxTheme: 'classic',
            transform: { scale: 1, offset: { x: 0, y: 0 } }
        };
        localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}${newId}`, JSON.stringify(initialProps));

        // Initialize empty objects in IndexedDB
        await ProjectStorage.saveProjectObjects(newId, [], [], []);

        // Update manifest
        setManifest(prev => {
            const updated = [...prev, newProject];
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
            return updated;
        });

        // Switch to the new project
        switchProject(newId);
        setEditingProjectId(newId);

        return newId;
    }, [switchProject]);

    const deleteProject = useCallback(async (projectId: string, projectName: string) => {
        // Prevent deleting the last canvas
        if (manifest.length <= 1) {
            alert('Cannot delete the last canvas. Create a new one first!');
            return false;
        }

        // Confirm deletion
        if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) {
            return false;
        }

        // If deleting the current project, switch to another one first
        if (projectId === currentProjectId) {
            const otherProject = manifest.find(m => m.id !== projectId);
            if (otherProject) {
                switchProject(otherProject.id);
            }
        }

        // Delete from storage
        await ProjectStorage.deleteProject(projectId);
        localStorage.removeItem(`${STORAGE_KEYS.PROPS_PREFIX}${projectId}`);

        // Remove from manifest
        setManifest(prev => {
            const updated = prev.filter(m => m.id !== projectId);
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
            return updated;
        });

        return true;
    }, [manifest, currentProjectId, switchProject]);

    const renameProject = useCallback((projectId: string, newName: string) => {
        setManifest(prev => {
            const updated = prev.map(m => m.id === projectId ? { ...m, name: newName } : m);
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const updateLastModified = useCallback((projectId: string) => {
        setManifest(prev => {
            const updated = prev.map(m =>
                m.id === projectId ? { ...m, lastModified: new Date().toISOString() } : m
            );
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
            return updated;
        });
    }, []);

    return {
        currentProjectId,
        manifest,
        editingProjectId,
        setEditingProjectId,
        switchProject,
        createProject,
        deleteProject,
        renameProject,
        updateLastModified
    };
};
