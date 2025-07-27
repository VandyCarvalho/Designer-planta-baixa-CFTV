
import React from 'react';
import type { Project, LineObject } from '../types';
import { PIXELS_PER_METER } from '../constants';

interface BudgetCalculatorProps {
    project: Project;
}

export const BudgetCalculator: React.FC<BudgetCalculatorProps> = ({ project }) => {
    const activeFloor = project.floors[project.activeFloorIndex];
    if (!activeFloor) return null;

    const totalWiringLength = activeFloor.layers.reduce((total, layer) => {
        if (!layer.visible) return total;
        const layerWiring = layer.objects
            .filter((obj): obj is LineObject => obj.type === 'wiring')
            .reduce((layerTotal, wire) => {
                return layerTotal + Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1);
            }, 0);
        return total + layerWiring;
    }, 0);

    const totalMeters = (totalWiringLength / PIXELS_PER_METER).toFixed(2);

    return (
        <div className="mt-4 border-t pt-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Orçamento</h2>
            <div className="mt-2 text-sm">
                <p>
                    <span className="font-medium text-gray-700">Total de Fiação: </span>
                    <span className="font-bold text-blue-600">{totalMeters} m</span>
                </p>
            </div>
        </div>
    );
};
