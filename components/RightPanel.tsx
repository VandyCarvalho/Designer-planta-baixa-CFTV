
import React from 'react';
import type { Project, CanvasObject, ModalConfig } from '../types';
import { PropertiesEditor } from './PropertiesEditor';
import { LayerManager } from './LayerManager';
import { BudgetCalculator } from './BudgetCalculator';
import { ICONS } from '../constants';
import { Icon } from './Icon';

interface RightPanelProps {
    project: Project;
    recordUpdate: (updater: (draft: Project) => void) => void;
    selectedObject: CanvasObject | null;
    setSelectedObject: React.Dispatch<React.SetStateAction<CanvasObject | null>>;
    openModal: (config: ModalConfig) => void;
    isVisible: boolean;
    toggleVisibility: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
    project,
    recordUpdate,
    selectedObject,
    setSelectedObject,
    openModal,
    isVisible,
    toggleVisibility
}) => {
    return (
        <div className={`absolute top-0 right-0 h-full z-20 pointer-events-none transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
             <aside className="w-64 bg-white/90 backdrop-blur-sm p-4 shadow-lg overflow-y-auto h-full pointer-events-auto border-l border-gray-200">
                {selectedObject ? (
                    <>
                        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Propriedades</h2>
                        <PropertiesEditor 
                            selectedObject={selectedObject} 
                            recordUpdate={recordUpdate} 
                            setSelectedObject={setSelectedObject} 
                        />
                    </>
                ) : (
                    <div className="pt-2">
                        <p className="text-sm text-center text-gray-500 mt-2 p-4 bg-gray-50 rounded-lg">Selecione um objeto para ver suas propriedades.</p>
                    </div>
                )}
                <div className="mt-4 border-t pt-4">
                   <LayerManager project={project} recordUpdate={recordUpdate} openModal={openModal} />
                </div>
                <BudgetCalculator project={project} />
            </aside>
            <button
                onClick={toggleVisibility}
                className="absolute top-1/2 -left-4 -translate-y-1/2 z-30 bg-white p-2 border-y border-l border-gray-300 text-gray-600 hover:bg-gray-100 rounded-l-md pointer-events-auto shadow-md"
                aria-label={isVisible ? "Hide Panel" : "Show Panel"}
            >
                <Icon svg={isVisible ? ICONS.chevronRight : ICONS.chevronLeft} />
            </button>
        </div>
    );
};
