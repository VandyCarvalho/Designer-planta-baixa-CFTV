
import React from 'react';
import type { Project, ModalConfig } from '../types';
import { ICONS } from '../constants';
import { Icon } from './Icon';

interface LayerManagerProps {
    project: Project;
    recordUpdate: (updater: (draft: Project) => void) => void;
    openModal: (config: ModalConfig) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({ project, recordUpdate, openModal }) => {
    const activeFloor = project.floors[project.activeFloorIndex];

    const addLayer = () => {
        openModal({
            title: 'Adicionar Nova Camada',
            value: `Camada ${activeFloor.layers.length + 1}`,
            onSave: (name) => {
                if (!name) return;
                recordUpdate(proj => {
                    const floor = proj.floors[proj.activeFloorIndex];
                    floor.layers.push({ id: `l_${Date.now()}`, name, objects: [], visible: true });
                });
            }
        });
    };

    const deleteLayer = () => {
        if (activeFloor.layers.length <= 1) {
            alert("Não é possível excluir a última camada.");
            return;
        }
        const activeLayerName = activeFloor.layers.find(l => l.id === activeFloor.activeLayerId)?.name;
        if (window.confirm(`Tem certeza que deseja excluir a camada "${activeLayerName}"?`)) {
            recordUpdate(proj => {
                const floor = proj.floors[proj.activeFloorIndex];
                floor.layers = floor.layers.filter(l => l.id !== floor.activeLayerId);
                floor.activeLayerId = floor.layers[0].id;
            });
        }
    };
    
    const handleLayerVisibility = (layerId: string) => {
        recordUpdate(proj => {
            const layer = proj.floors[proj.activeFloorIndex].layers.find(l => l.id === layerId);
            if (layer) layer.visible = !layer.visible;
        });
    };

    const setActiveLayer = (layerId: string) => {
        recordUpdate(proj => {
            proj.floors[proj.activeFloorIndex].activeLayerId = layerId;
        });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                 <h2 className="text-lg font-semibold text-gray-700">Camadas</h2>
                <div className="flex space-x-2">
                    <button onClick={addLayer} className="px-2 py-1 text-lg font-bold text-gray-600 hover:bg-gray-200 rounded">+</button>
                    <button onClick={deleteLayer} className="px-2 py-1 text-lg font-bold text-gray-600 hover:bg-gray-200 rounded">-</button>
                </div>
            </div>
            <ul className="space-y-1">
                {activeFloor.layers.map(layer => (
                    <li 
                        key={layer.id} 
                        onClick={() => setActiveLayer(layer.id)} 
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${activeFloor.activeLayerId === layer.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    >
                        <span className={`flex-grow text-sm ${activeFloor.activeLayerId === layer.id ? 'font-semibold text-blue-800' : 'text-gray-700'}`}>{layer.name}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleLayerVisibility(layer.id); }} 
                            className="ml-2 text-gray-500 hover:text-gray-800"
                            aria-label={layer.visible ? "Hide Layer" : "Show Layer"}
                        >
                           <Icon svg={layer.visible ? ICONS.eye : ICONS.eyeSlash} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
