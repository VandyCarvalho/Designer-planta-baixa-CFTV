
export type Tool = 'select' | 'movePdf' | 'text' | 'rect' | 'line' | 'wiring' | 'bulletCam' | 'domeCam';

export interface BaseObject {
    id: string;
    type: string;
}

export interface RectObject extends BaseObject {
    type: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface LineObject extends BaseObject {
    type: 'line' | 'wiring';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface TextObject extends BaseObject {
    type: 'text';
    x: number;
    y: number;
    content: string;
    size: number;
}

export interface CameraObject extends BaseObject {
    type: 'bulletCam' | 'domeCam';
    x: number;
    y: number;
    rotation: number;
    fov: number;
    range: number;
}

export type CanvasObject = RectObject | LineObject | TextObject | CameraObject;

export interface PdfBackground {
    data: string;
    width: number;
    height: number;
    x: number;
    y: number;
}

export interface Layer {
    id: string;
    name: string;
    objects: CanvasObject[];
    visible: boolean;
}

export interface Floor {
    name: string;
    layers: Layer[];
    activeLayerId: string;
    pdfBackground?: PdfBackground | null;
}

export interface Project {
    floors: Floor[];
    activeFloorIndex: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface ViewTransform {
    x: number;
    y: number;
    scale: number;
}

export interface MouseState {
    isDown: boolean;
    start: Point;
    current: Point;
}

export interface ActionInfo {
    type: 'none' | 'dragging' | 'resizing' | 'rotating';
    object?: CanvasObject;
    startObjectState?: any;
    handle?: string;
}

export interface ModalConfig {
    title: string;
    value: string;
    onSave: (value: string) => void;
}
