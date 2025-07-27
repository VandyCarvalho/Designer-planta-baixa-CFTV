
import React from 'react';
import type { Project, CanvasObject, ModalConfig } from '../types';

interface TabsProps {
    project: Project;
    recordUpdate: (updater: (draft: Project) => void) => void;
    setSelectedObject: React.Dispatch<React.SetStateAction<CanvasObject | null>>;
    openModal: (config: ModalConfig) => void;
}

export const Tabs: React.FC<TabsProps> = ({ project, recordUpdate, setSelectedObject, openModal }) => {
    
    const switchTab = (index: number) => {
        if (index === project.activeFloorIndex) return;
        setSelectedObject(null);
        recordUpdate(p => { p.activeFloorIndex = index; });
    };

    const addTab = () => {
        openModal({
            title: 'Adicionar Novo Andar',
            value: `Andar ${project.floors.length + 1}`,
            onSave: (name) => {
                if (!name) return;
                recordUpdate(p => {
                    const now = Date.now();
                    const newFloor = {
                        name,
                        layers: [
                            { id: `l_${now}_1`, name: 'Paredes e Estruturas', objects: [], visible: true },
                            { id: `l_${now}_2`, name: 'Câmeras e Anotações', objects: [], visible: true }
                        ],
                        activeLayerId: `l_${now}_2`
                    };
                    p.floors.push(newFloor);
                    p.activeFloorIndex = p.floors.length - 1;
                    setSelectedObject(null);
                });
            }
        });
    };
    
    const renameTab = (index: number) => {
        const currentName = project.floors[index].name;
        openModal({
            title: 'Renomear Andar',
            value: currentName,
            onSave: (newName) => {
                if (newName && newName !== currentName) {
                    recordUpdate(p => {
                        p.floors[index].name = newName;
                    });
                }
            }
        });
    };

    return (
        <div className="flex border-b border-gray-300 bg-gray-200 pl-2">
            {project.floors.map((floor, index) => (
                <button 
                    key={index} 
                    onDoubleClick={() => renameTab(index)} 
                    onClick={() => switchTab(index)} 
                    className={`px-4 py-2 border-t-2 text-sm font-medium text-gray-700 rounded-t-md -mb-px
                        ${project.activeFloorIndex === index 
                            ? 'bg-white border-blue-500' 
                            : 'bg-gray-100 hover:bg-gray-50 border-transparent hover:border-gray-300'}`
                    }
                >
                    {floor.name}
                </button>
            ))}
            <button onClick={addTab} className="px-3 py-1 text-gray-500 hover:bg-gray-300 rounded-t-md font-bold text-lg" aria-label="Add Floor">+</button>
        </div>
    );
};
