import React from 'react';

interface SettingsMenuProps {
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    backgroundPattern: 'grid' | 'dots' | 'lines';
    setBackgroundPattern: (pattern: 'grid' | 'dots' | 'lines') => void;
    backgroundOpacity: number;
    setBackgroundOpacity: (opacity: number) => void;
    theme: 'light' | 'dark' | 'paper';
    setTheme: (theme: 'light' | 'dark' | 'paper') => void;
    syntaxTheme: 'classic' | 'monokai' | 'nord' | 'solarized' | 'ink';
    setSyntaxTheme: (theme: 'classic' | 'monokai' | 'nord' | 'solarized' | 'ink') => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({
    showSettings,
    setShowSettings,
    backgroundPattern,
    setBackgroundPattern,
    backgroundOpacity,
    setBackgroundOpacity,
    theme,
    setTheme,
    syntaxTheme,
    setSyntaxTheme
}) => {
    return (
        <div className="top-right-controls pointer-auto" onPointerDown={(e) => e.stopPropagation()}>
            <button
                className={`control-btn pointer-auto ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
            >
                <i className={`bi ${showSettings ? 'bi-gear-fill' : 'bi-gear'}`}></i>
            </button>

            {showSettings && (
                <div className="settings-menu">
                    <div className="settings-group">
                        <div className="settings-label">Background Pattern</div>
                        <div className="settings-row">
                            <button
                                className={`settings-item compact ${backgroundPattern === 'grid' ? 'active' : ''}`}
                                onClick={() => setBackgroundPattern('grid')}
                            >
                                <i className="bi bi-grid-3x3"></i>
                                Grid
                            </button>
                            <button
                                className={`settings-item compact ${backgroundPattern === 'dots' ? 'active' : ''}`}
                                onClick={() => setBackgroundPattern('dots')}
                            >
                                <i className="bi bi-dot"></i>
                                Dots
                            </button>
                            <button
                                className={`settings-item compact ${backgroundPattern === 'lines' ? 'active' : ''}`}
                                onClick={() => setBackgroundPattern('lines')}
                            >
                                <i className="bi bi-distribute-vertical"></i>
                                Lines
                            </button>
                        </div>
                    </div>

                    <div className="settings-group">
                        <div className="settings-label">Transparency</div>
                        <div className="settings-slider-container">
                            <input
                                type="range"
                                className="settings-slider"
                                min="0"
                                max="1.4"
                                step="0.01"
                                value={backgroundOpacity}
                                onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <div className="flex-between" style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                <span>Min</span>
                                <span>{Math.round(backgroundOpacity * 100 / 1.4)}%</span>
                                <span>Max</span>
                            </div>
                        </div>
                    </div>

                    <div className="toolbar-divider" style={{ margin: '4px 0', width: '100%', height: '1px' }}></div>

                    <div className="settings-group">
                        <div className="settings-label">Appearance</div>
                        <div className="settings-row">
                            <button
                                className={`settings-item compact ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => setTheme('light')}
                            >
                                <i className="bi bi-sun"></i>
                                Light
                            </button>
                            <button
                                className={`settings-item compact ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => setTheme('dark')}
                            >
                                <i className="bi bi-moon-stars"></i>
                                Dark
                            </button>
                            <button
                                className={`settings-item compact ${theme === 'paper' ? 'active' : ''}`}
                                onClick={() => setTheme('paper')}
                            >
                                <i className="bi bi-journal-text"></i>
                                Paper
                            </button>
                        </div>
                    </div>

                    <div className="toolbar-divider divider-horizontal"></div>

                    <div className="settings-group">
                        <div className="settings-label">Syntax Theme</div>
                        <div className="settings-row flex-wrap">
                            <button
                                className={`settings-item compact ${syntaxTheme === 'classic' ? 'active' : ''}`}
                                onClick={() => setSyntaxTheme('classic')}
                                title="Classic CodeCanvas"
                            >
                                <div className="theme-preview theme-preview-box" style={{ background: '#ff79c6' }}></div>
                                Classic
                            </button>
                            <button
                                className={`settings-item compact ${syntaxTheme === 'monokai' ? 'active' : ''}`}
                                onClick={() => setSyntaxTheme('monokai')}
                                title="Vibrant Monokai"
                            >
                                <div className="theme-preview theme-preview-box" style={{ background: '#f92672' }}></div>
                                Monokai
                            </button>
                            <button
                                className={`settings-item compact ${syntaxTheme === 'nord' ? 'active' : ''}`}
                                onClick={() => setSyntaxTheme('nord')}
                                title="Arctic Nord"
                            >
                                <div className="theme-preview theme-preview-box" style={{ background: '#81a1c1' }}></div>
                                Nord
                            </button>
                            <button
                                className={`settings-item compact ${syntaxTheme === 'solarized' ? 'active' : ''}`}
                                onClick={() => setSyntaxTheme('solarized')}
                                title="Solarized Contrast"
                            >
                                <div className="theme-preview theme-preview-box" style={{ background: '#859900' }}></div>
                                Solarized
                            </button>
                            <button
                                className={`settings-item compact ${syntaxTheme === 'ink' ? 'active' : ''}`}
                                onClick={() => setSyntaxTheme('ink')}
                                title="Ink-on-Paper"
                            >
                                <div className="theme-preview theme-preview-box" style={{ background: '#433422' }}></div>
                                Ink
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsMenu;
