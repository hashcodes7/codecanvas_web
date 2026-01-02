import React from 'react';

interface MainToolbarProps {
    currentTool: 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'pencil';
    setCurrentTool: (tool: 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'pencil') => void;
    defaultLineType: 'line' | 'arrow' | 'bi-arrow';
    setDefaultLineType: (type: 'line' | 'arrow' | 'bi-arrow') => void;
    addTextNode: () => void;
    addFileNode: () => void;
}

const MainToolbar: React.FC<MainToolbarProps> = ({
    currentTool,
    setCurrentTool,
    defaultLineType,
    setDefaultLineType,
    addTextNode,
    addFileNode
}) => {
    return (
        <div className="main-toolbar">
            <div className="toolbar-group">
                <button
                    className={`toolbar-btn ${currentTool === 'select' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('select')}
                    title="Select Tool"
                >
                    <i className="bi bi-cursor mirrored-icon"></i>
                </button>
                <button
                    className={`toolbar-btn ${currentTool === 'rectangle' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('rectangle')}
                    title="Rectangle"
                >
                    <i className="bi bi-square"></i>
                </button>
                <button
                    className={`toolbar-btn ${currentTool === 'ellipse' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('ellipse')}
                    title="Ellipse"
                >
                    <i className="bi bi-circle"></i>
                </button>
                <button
                    className={`toolbar-btn ${currentTool === 'diamond' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('diamond')}
                    title="Diamond"
                >
                    <i className="bi bi-diamond"></i>
                </button>
                <button
                    className={`toolbar-btn ${currentTool === 'arrow' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('arrow')}
                    title="Arrow"
                >
                    <i className="bi bi-arrow-up-right"></i>
                </button>
                <button
                    className={`toolbar-btn ${currentTool === 'pencil' ? 'active' : ''}`}
                    onClick={() => setCurrentTool('pencil')}
                    title="Pencil (Freehand Drawing)"
                >
                    <i className="bi bi-pencil"></i>
                </button>
            </div>

            <div className="toolbar-divider"></div>

            <div className="toolbar-group">
                <button className="toolbar-btn primary" onClick={addTextNode} title="Add Text Note">
                    <i className="bi bi-sticky"></i>
                </button>
                <button className="toolbar-btn" onClick={addFileNode} title="Add File">
                    <i className="bi bi-file-earmark-plus"></i>
                </button>
            </div>

            <div className="toolbar-divider"></div>

            <div className="toolbar-group">
                <button
                    className={`toolbar-btn ${defaultLineType === 'line' ? 'active' : ''}`}
                    onClick={() => setDefaultLineType('line')}
                    title="Non-directional Line"
                >
                    <i className="bi bi-dash"></i>
                </button>
                <button
                    className={`toolbar-btn ${defaultLineType === 'arrow' ? 'active' : ''}`}
                    onClick={() => setDefaultLineType('arrow')}
                    title="Single Arrow"
                >
                    <i className="bi bi-arrow-right"></i>
                </button>
                <button
                    className={`toolbar-btn ${defaultLineType === 'bi-arrow' ? 'active' : ''}`}
                    onClick={() => setDefaultLineType('bi-arrow')}
                    title="Bi-directional Arrow"
                >
                    <i className="bi bi-arrow-left-right"></i>
                </button>
            </div>

            <div className="toolbar-divider"></div>
            <button className="toolbar-btn" title="Project Settings">
                <i className="bi bi-share"></i>
            </button>
        </div>
    );
};

export default MainToolbar;
