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

                <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                        Created by <a href="https://www.linkedin.com/in/hashcodes7" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Harsh Vardhan Verma</a>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <a
                            href="https://www.linkedin.com/in/hashcodes7"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-subtle)', textDecoration: 'none' }}
                            className="hover-opacity"
                        >
                            <i className="bi bi-linkedin" style={{ color: '#0077b5' }}></i> LinkedIn
                        </a>
                        <a
                            href="https://github.com/hashcodes7"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-subtle)', textDecoration: 'none' }}
                            className="hover-opacity"
                        >
                            <i className="bi bi-github" style={{ color: 'var(--text-main)' }}></i> GitHub
                        </a>
                    </div>
                </div>
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
