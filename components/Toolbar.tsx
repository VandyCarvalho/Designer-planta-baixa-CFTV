
import React from 'react';
import type { Tool } from '../types';
import { ICONS } from '../constants';
import { Icon } from './Icon';

interface ToolbarProps {
    currentTool: Tool;
    setCurrentTool: (tool: Tool) => void;
    deleteSelectedObject: () => void;
    exportToPdf: () => void;
    saveProject: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    pdfInputRef: React.RefObject<HTMLInputElement>;
    handlePdfImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleUndo: () => void;
    canUndo: boolean;
}

interface ToolButtonProps {
    toolName: Tool;
    icon: string;
    label: string;
    currentTool: Tool;
    onClick: (tool: Tool) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ toolName, icon, label, currentTool, onClick }) => (
    <button
        className={`flex items-center justify-start space-x-3 p-2 rounded-lg border transition-colors w-full ${currentTool === toolName ? 'bg-blue-500 text-white border-blue-500' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
        onClick={() => onClick(toolName)}
    >
        <Icon svg={icon} />
        <span>{label}</span>
    </button>
);

export const Toolbar: React.FC<ToolbarProps> = ({
    currentTool,
    setCurrentTool,
    deleteSelectedObject,
    exportToPdf,
    saveProject,
    fileInputRef,
    handleFileLoad,
    pdfInputRef,
    handlePdfImport,
    handleUndo,
    canUndo,
}) => {
    return (
        <aside className="w-56 bg-white p-4 shadow-lg flex flex-col space-y-4 overflow-y-auto z-10">
            <div>
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Ferramentas</h2>
                <div className="flex flex-col space-y-2">
                    <ToolButton toolName="select" icon={ICONS.select} label="Selecionar" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="movePdf" icon={ICONS.move} label="Mover Fundo" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="text" icon={ICONS.text} label="Texto" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="rect" icon={ICONS.rect} label="Retângulo" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="line" icon={ICONS.line} label="Linha" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="wiring" icon={ICONS.wiring} label="Fiação" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="bulletCam" icon={ICONS.bulletCam} label="Câm. Bullet" currentTool={currentTool} onClick={setCurrentTool} />
                    <ToolButton toolName="domeCam" icon={ICONS.domeCam} label="Câm. Dome" currentTool={currentTool} onClick={setCurrentTool} />
                </div>
            </div>

            <div className="border-t pt-4 flex flex-col space-y-2 flex-grow justify-end">
                 <button onClick={handleUndo} disabled={!canUndo} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                    <Icon svg={ICONS.undo} /> <span>Desfazer</span>
                </button>
                <button onClick={deleteSelectedObject} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                    <Icon svg={ICONS.delete} /> <span>Excluir</span>
                </button>
                <button onClick={exportToPdf} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors">
                    <Icon svg={ICONS.export} /> <span>Exportar PDF</span>
                </button>
                <button onClick={() => pdfInputRef.current?.click()} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors">
                    <Icon svg={ICONS.load} /> <span>Importar Fundo</span>
                </button>
                <input type="file" ref={pdfInputRef} onChange={handlePdfImport} className="hidden" accept=".pdf" />
                <button onClick={saveProject} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    <Icon svg={ICONS.save} /> <span>Salvar Projeto</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors">
                    <Icon svg={ICONS.load} /> <span>Carregar Projeto</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileLoad} className="hidden" accept=".json" />
            </div>
        </aside>
    );
};
