
import React from 'react';
import type { CanvasObject, CameraObject, TextObject, Project } from '../types';
import { PIXELS_PER_METER } from '../constants';

interface PropertiesEditorProps {
    selectedObject: CanvasObject;
    recordUpdate: (updater: (draft: Project) => void) => void;
    setSelectedObject: React.Dispatch<React.SetStateAction<CanvasObject | null>>;
}

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({ selectedObject, recordUpdate, setSelectedObject }) => {
    
    const findObjectById = (proj: Project, id: string): CanvasObject | undefined => 
        proj.floors.flatMap(f => f.layers).flatMap(l => l.objects).find(o => o.id === id);

    const handlePropChange = (prop: string, value: any) => {
        recordUpdate(proj => {
            const obj = findObjectById(proj, selectedObject.id);
            if (obj) {
                (obj as any)[prop] = value;
            }
        });
        setSelectedObject(prev => prev ? { ...prev, [prop]: value } : null);
    };

    const isCamera = selectedObject.type === 'bulletCam' || selectedObject.type === 'domeCam';
    const isText = selectedObject.type === 'text';

    return (
        <div className="space-y-4 mt-2 text-sm">
            <p className="font-medium">ID: <span className="font-normal text-gray-600 truncate block">{selectedObject.id}</span></p>
            
            {isCamera && (
                <>
                    <div>
                        <label className="block font-medium text-gray-700">Ângulo de Visão (FOV)</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <input 
                                type="range" 
                                min="10" 
                                max={(selectedObject as CameraObject).type === 'domeCam' ? 359 : 180} 
                                value={(selectedObject as CameraObject).fov} 
                                onChange={e => handlePropChange('fov', parseInt(e.target.value))} 
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-gray-600 w-12 text-center">{(selectedObject as CameraObject).fov}°</span>
                        </div>
                    </div>
                    <div>
                        <label className="block font-medium text-gray-700">Alcance</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <input 
                                type="range" 
                                min="20" 
                                max="400" 
                                value={(selectedObject as CameraObject).range} 
                                onChange={e => handlePropChange('range', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-gray-600 w-12 text-center">{((selectedObject as CameraObject).range / PIXELS_PER_METER).toFixed(1)}m</span>
                        </div>
                    </div>
                </>
            )}

            {isText && (
                <>
                    <div>
                        <label className="block font-medium text-gray-700">Texto</label>
                        <input 
                            type="text" 
                            value={(selectedObject as TextObject).content} 
                            onChange={e => handlePropChange('content', e.target.value)} 
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block font-medium text-gray-700">Tamanho da Fonte</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <input 
                                type="range" 
                                min="8" 
                                max="48" 
                                value={(selectedObject as TextObject).size} 
                                onChange={e => handlePropChange('size', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-gray-600 w-12 text-center">{(selectedObject as TextObject).size}px</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
