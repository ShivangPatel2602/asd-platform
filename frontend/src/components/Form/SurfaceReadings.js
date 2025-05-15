import React from 'react';
import './SurfaceReadings.css';

const SurfaceReadingsInput = ({ surfaces, onSurfaceAdd, onSurfaceRemove, onDataChange }) => {
    return (
        <div className="surface-readings-container">
            {surfaces.map((surface, index) => (
                <div key={index} className="surface-entry">
                    <div className="surface-header">
                        <h3>Surface {index + 1}</h3>
                        {surfaces.length > 1 && (
                            <button 
                                type="button" 
                                className="remove-surface-btn"
                                onClick={() => onSurfaceRemove(index)}
                            >
                                <span>🗑️</span>
                            </button>
                        )}
                    </div>
                    <div className="surface-fields">
                        <div className="input-group">
                            <label>Surface Type</label>
                            <input
                                type="text"
                                value={surface.surface}
                                onChange={(e) => onDataChange(index, 'surface', e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Pre-treatment</label>
                            <input
                                type="text"
                                value={surface.pretreatment}
                                onChange={(e) => onDataChange(index, 'pretreatment', e.target.value)}
                                required
                            />
                        </div>
                        <div className="readings-input">
                            <label>Cycle vs Thickness Data</label>
                            <textarea
                                rows="6"
                                value={surface.rawData}
                                onChange={(e) => onDataChange(index, 'rawData', e.target.value)}
                                placeholder="Format: cycle thickness&#10;Example:&#10;0 0&#10;10 0.5&#10;20 1.0"
                                required
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button 
                type="button" 
                className="add-surface-btn"
                onClick={onSurfaceAdd}
            >
                <span>➕</span> Add Another Surface
            </button>
        </div>
    );
};

export default SurfaceReadingsInput;