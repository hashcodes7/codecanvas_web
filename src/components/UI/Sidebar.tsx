import React from 'react';
import type { CanvasManifestItem } from '../../types';

interface SidebarProps {
    manifest: CanvasManifestItem[];
    currentProjectId: string;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    switchProject: (id: string) => void;
    createProject: () => void;
    deleteProject: (id: string, name: string) => void;
    editingProjectId: string | null;
    setEditingProjectId: (id: string | null) => void;
    renameProject: (id: string, newName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    manifest,
    currentProjectId,
    isSidebarOpen,
    setIsSidebarOpen,
    switchProject,
    createProject,
    deleteProject,
    editingProjectId,
    setEditingProjectId,
    renameProject
}) => {
    return (
        <div className={`sidebar-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
            <div className="sidebar" onPointerDown={(e) => e.stopPropagation()}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <i className="bi bi-stack"></i>
                        CodeCanvas
                    </div>
                    <button className="toolbar-btn" onClick={() => setIsSidebarOpen(false)}>
                        <i className="bi bi-chevron-left"></i>
                    </button>
                </div>

                <div className="project-list-container">
                    <div className="settings-label sidebar-label">Your Canvases</div>
                    {manifest.map(p => (
                        <div
                            key={p.id}
                            className={`sidebar-project-item ${p.id === currentProjectId ? 'active' : ''}`}
                            onClick={() => switchProject(p.id)}
                        >
                            {editingProjectId === p.id ? (
                                <input
                                    autoFocus
                                    value={p.name}
                                    onChange={(e) => renameProject(p.id, e.target.value)}
                                    onBlur={() => setEditingProjectId(null)}
                                    onKeyDown={(e) => e.key === 'Enter' && setEditingProjectId(null)}
                                />
                            ) : (
                                <div className="project-item-header">
                                    <div className="project-item-name">{p.name}</div>
                                    <div className="project-item-actions">
                                        <button
                                            className="toolbar-btn project-action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingProjectId(p.id);
                                            }}
                                            title="Rename Canvas"
                                        >
                                            <i className="bi bi-pencil"></i>
                                        </button>
                                        <button
                                            className="toolbar-btn danger project-action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteProject(p.id, p.name);
                                            }}
                                            title="Delete Canvas"
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="project-item-meta">
                                <i className="bi bi-clock-history"></i>
                                {new Date(p.lastModified).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    className="create-project-btn"
                    onClick={createProject}
                >
                    <i className="bi bi-plus-lg"></i>
                    New Canvas
                </button>
            </div>

            {!isSidebarOpen && (
                <div className="sidebar-tab" onClick={() => setIsSidebarOpen(true)}>
                    <i className="bi bi-layout-sidebar-inset"></i>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
