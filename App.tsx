
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { RightPanel } from './components/RightPanel';
import { InputModal } from './components/InputModal';
import { Tabs } from './components/Tabs';
import { ICONS, PIXELS_PER_METER, HANDLE_SIZE } from './constants';
import { Icon } from './components/Icon';
import type { 
    Project, 
    CanvasObject, 
    Tool, 
    ActionInfo, 
    MouseState, 
    Point,
    ModalConfig,
    RectObject,
    CameraObject,
    LineObject,
    TextObject
} from './types';

// Declare pdf.js and jspdf to be available on the window object
declare const pdfjsLib: any;
declare const jspdf: any;

export default function App() {
    const initialProjectState: Project = {
        floors: [{
            name: 'Térreo',
            layers: [
                { id: 'l1', name: 'Paredes e Estruturas', objects: [], visible: true },
                { id: 'l2', name: 'Câmeras e Anotações', objects: [], visible: true }
            ],
            activeLayerId: 'l2',
            pdfBackground: null
        }],
        activeFloorIndex: 0
    };

    const [history, setHistory] = useState<Project[]>([initialProjectState]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const project = history[historyIndex];

    const [currentTool, setCurrentTool] = useState<Tool>('select');
    const [selectedObject, setSelectedObject] = useState<CanvasObject | null>(null);
    const [actionInfo, setActionInfo] = useState<ActionInfo>({ type: 'none' });
    const [mouseState, setMouseState] = useState<MouseState>({ isDown: false, start: {x:0, y:0}, current: {x:0, y:0}});
    
    const [isModalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<ModalConfig>({ title: '', value: '', onSave: () => {} });
    const [isRightPanelVisible, setRightPanelVisible] = useState(true);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mainContainerRef = useRef<HTMLElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const cameraImages = useRef<{[key: string]: HTMLImageElement}>({});
    const viewTransform = useRef({ x: 0, y: 0, scale: 1 });
    const lastPanPoint = useRef<Point | null>(null);
    const lastTouchDistance = useRef<number | null>(null);
    const pdfImageCache = useRef<{[key: string]: HTMLImageElement}>({});

    const recordUpdate = useCallback((updater: (draft: Project) => void) => {
        const newHistory = history.slice(0, historyIndex + 1);
        const currentProject = newHistory[newHistory.length - 1];
        const newProject = JSON.parse(JSON.stringify(currentProject)) as Project;
        updater(newProject);
        
        setHistory([...newHistory, newProject]);
        setHistoryIndex(newHistory.length);
    }, [history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            setSelectedObject(null);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const openModal = (config: ModalConfig) => {
        setModalConfig(config);
        setModalVisible(true);
    };

    useEffect(() => {
        const svgs = {
            bulletCam: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#dc2626" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.11-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/></svg>`,
            domeCam: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="#4338ca" viewBox="0 0 16 16"><g transform="translate(0.5, 0.5)" fill="none" stroke="#4338ca" stroke-width="1.5"><path d="M7.5,1.5a6,6,0,1,0,0,12a6,6,0,0,0,0,-12Z" stroke-linecap="round"/><path d="M7.5,4.5a3,3,0,1,0,0,6a3,3,0,0,0,0,-6Z"/></g></svg>`,
        };
        
        const imagePromises = Object.entries(svgs).map(([key, svgData]) => {
            return new Promise<void>(resolve => {
                const img = new Image();
                img.src = 'data:image/svg+xml;base64,' + window.btoa(svgData);
                img.onload = () => {
                    cameraImages.current[key] = img;
                    resolve();
                };
                img.onerror = () => resolve(); 
            });
        });

        Promise.all(imagePromises).then(() => setImagesLoaded(true));
    }, []);
    
    // Drawing Logic
    useEffect(() => {
        if (!imagesLoaded) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const main = mainContainerRef.current;
        if (!canvas || !ctx || !main) return;

        // Dynamic Grid Background
        const { x, y, scale } = viewTransform.current;
        canvas.style.backgroundSize = `${PIXELS_PER_METER * scale}px ${PIXELS_PER_METER * scale}px`;
        canvas.style.backgroundPosition = `${x}px ${y}px`;
        canvas.style.backgroundImage = `
            linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)
        `;
    
        const drawAll = () => {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(viewTransform.current.x, viewTransform.current.y);
            ctx.scale(viewTransform.current.scale, viewTransform.current.scale);

            const floor = project.floors[project.activeFloorIndex];
            if (!floor) {
                ctx.restore();
                return;
            }

            if (floor.pdfBackground && pdfImageCache.current[floor.pdfBackground.data] && pdfImageCache.current[floor.pdfBackground.data].complete) {
                const bg = floor.pdfBackground;
                ctx.drawImage(pdfImageCache.current[bg.data], bg.x, bg.y);
            }

            const allVisibleObjects = floor.layers.flatMap(l => l.visible ? l.objects : []);
            allVisibleObjects.forEach(obj => {
                if (obj.type === 'bulletCam' || obj.type === 'domeCam') {
                    drawCameraFov(ctx, obj as CameraObject, allVisibleObjects);
                }
            });

            floor.layers.forEach(layer => {
                if (layer.visible) {
                    layer.objects.forEach(obj => drawObject(ctx, obj));
                }
            });
            
            if (selectedObject) drawSelection(ctx, selectedObject);
            if (mouseState.isDown && (currentTool === 'rect' || currentTool === 'line' || currentTool === 'wiring')) drawPreview(ctx);
            
            ctx.restore();
        };
        
        const resizeCanvas = () => {
            canvas.width = main.clientWidth;
            canvas.height = main.clientHeight;
            drawAll();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        drawAll(); // Initial draw

        return () => window.removeEventListener('resize', resizeCanvas);

    }, [project, selectedObject, mouseState, imagesLoaded, recordUpdate]);


    const drawObject = (ctx: CanvasRenderingContext2D, obj: CanvasObject) => {
        ctx.save();
        if (obj.type === 'rect') {
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
            drawMeasurement(ctx, (obj.x + obj.w / 2), obj.y - 5, `${(Math.abs(obj.w) / PIXELS_PER_METER).toFixed(1)} m`);
            drawMeasurement(ctx, obj.x - 5, (obj.y + obj.h / 2), `${(Math.abs(obj.h) / PIXELS_PER_METER).toFixed(1)} m`, -Math.PI / 2);
        } else if (obj.type === 'line' || obj.type === 'wiring') {
            ctx.strokeStyle = obj.type === 'line' ? '#374151' : '#dc2626';
            ctx.lineWidth = obj.type === 'line' ? 3 : 2;
            if (obj.type === 'wiring') ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(obj.x1, obj.y1);
            ctx.lineTo(obj.x2, obj.y2);
            ctx.stroke();
            const length = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
            const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
            drawMeasurement(ctx, (obj.x1 + obj.x2) / 2, (obj.y1 + obj.y2) / 2 - 8, `${(length / PIXELS_PER_METER).toFixed(1)} m`, angle);
        } else if (obj.type === 'bulletCam' || obj.type === 'domeCam') {
            const img = cameraImages.current[obj.type];
            if (img && img.complete) {
                ctx.translate(obj.x, obj.y);
                if (obj.rotation) ctx.rotate(obj.rotation);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
            }
        } else if (obj.type === 'text') {
            ctx.font = `${obj.size}px Inter`;
            ctx.fillStyle = '#1f2937';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(obj.content, obj.x, obj.y);
        }
        ctx.restore();
    };

    const drawSelection = (ctx: CanvasRenderingContext2D, obj: CanvasObject) => {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1 / viewTransform.current.scale;
        ctx.setLineDash([5 / viewTransform.current.scale, 5 / viewTransform.current.scale]);
        const padding = 5 / viewTransform.current.scale;

        if (obj.type === 'rect') {
            ctx.strokeRect(obj.x - padding, obj.y - padding, obj.w + padding * 2, obj.h + padding * 2);
            ctx.setLineDash([]);
            ctx.fillStyle = '#f59e0b';
            const handles = getRectHandles(obj);
            Object.values(handles).forEach(handle => {
                ctx.fillRect(handle.x - HANDLE_SIZE / 2 / viewTransform.current.scale, handle.y - HANDLE_SIZE / 2 / viewTransform.current.scale, HANDLE_SIZE / viewTransform.current.scale, HANDLE_SIZE / viewTransform.current.scale);
            });
        } else if (obj.type === 'bulletCam' || obj.type === 'domeCam') {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 20 / viewTransform.current.scale, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);
            const handleX = obj.x + Math.cos(obj.rotation) * 30 / viewTransform.current.scale;
            const handleY = obj.y + Math.sin(obj.rotation) * 30 / viewTransform.current.scale;
            ctx.beginPath();
            ctx.arc(handleX, handleY, 6 / viewTransform.current.scale, 0, 2 * Math.PI);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
        } else if (obj.type === 'line' || obj.type === 'wiring') {
            const minX = Math.min(obj.x1, obj.x2) - padding;
            const minY = Math.min(obj.y1, obj.y2) - padding;
            ctx.strokeRect(minX, minY, Math.max(obj.x1, obj.x2) + padding - minX, Math.max(obj.y1, obj.y2) + padding - minY);
        } else if (obj.type === 'text') {
            ctx.font = `${obj.size}px Inter`;
            const textMetrics = ctx.measureText(obj.content);
            ctx.strokeRect(obj.x - padding, obj.y - padding, textMetrics.width + padding * 2, obj.size + padding * 2);
        }
        ctx.restore();
    };

    const drawPreview = (ctx: CanvasRenderingContext2D) => {
        if (currentTool === 'rect') {
           ctx.save();
           ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
           ctx.strokeStyle = '#3b82f6';
           ctx.lineWidth = 2;
           const w = mouseState.current.x - mouseState.start.x;
           const h = mouseState.current.y - mouseState.start.y;
           ctx.fillRect(mouseState.start.x, mouseState.start.y, w, h);
           ctx.strokeRect(mouseState.start.x, mouseState.start.y, w, h);
           drawMeasurement(ctx, mouseState.start.x + w / 2, mouseState.start.y - 5, `${(Math.abs(w) / PIXELS_PER_METER).toFixed(1)} m`);
           drawMeasurement(ctx, mouseState.start.x - 5, mouseState.start.y + h / 2, `${(Math.abs(h) / PIXELS_PER_METER).toFixed(1)} m`, -Math.PI / 2);
           ctx.restore();
       } else if (currentTool === 'line' || currentTool === 'wiring') {
           ctx.save();
           ctx.strokeStyle = currentTool === 'line' ? '#374151' : '#dc2626';
           ctx.lineWidth = currentTool === 'line' ? 3 : 2;
           if(currentTool === 'wiring') ctx.setLineDash([5, 5]);
           ctx.beginPath();
           ctx.moveTo(mouseState.start.x, mouseState.start.y);
           ctx.lineTo(mouseState.current.x, mouseState.current.y);
           ctx.stroke();
           const length = Math.hypot(mouseState.current.x - mouseState.start.x, mouseState.current.y - mouseState.start.y);
           const angle = Math.atan2(mouseState.current.y - mouseState.start.y, mouseState.current.x - mouseState.start.x);
           drawMeasurement(ctx, (mouseState.start.x + mouseState.current.x) / 2, (mouseState.start.y + mouseState.current.y) / 2 - 8, `${(length / PIXELS_PER_METER).toFixed(1)} m`, angle);
           ctx.restore();
       }
    };

    const drawMeasurement = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, angle = 0) => {
        ctx.save();
        ctx.fillStyle = '#374151';
        ctx.font = `${12 / viewTransform.current.scale}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (angle < -Math.PI / 2 || angle > Math.PI / 2) ctx.rotate(Math.PI);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    const drawCameraFov = (ctx: CanvasRenderingContext2D, camera: CameraObject, allObjects: CanvasObject[]) => {
        const walls: { p1: Point; p2: Point }[] = [];
        allObjects.forEach(obj => {
            if (obj === camera || (obj.type !== 'rect' && obj.type !== 'line')) return;
            if (obj.type === 'rect') {
                const r = obj;
                walls.push({ p1: { x: r.x, y: r.y }, p2: { x: r.x + r.w, y: r.y } });
                walls.push({ p1: { x: r.x + r.w, y: r.y }, p2: { x: r.x + r.w, y: r.y + r.h } });
                walls.push({ p1: { x: r.x + r.w, y: r.y + r.h }, p2: { x: r.x, y: r.y + r.h } });
                walls.push({ p1: { x: r.x, y: r.y + r.h }, p2: { x: r.x, y: r.y } });
            } else if (obj.type === 'line') {
                walls.push({ p1: { x: obj.x1, y: obj.y1 }, p2: { x: obj.x2, y: obj.y2 } });
            }
        });

        const pointsOfInterest = walls.flatMap(wall => [wall.p1, wall.p2]);
        const fovRad = camera.fov * (Math.PI / 180);
        const startAngle = camera.rotation - fovRad / 2;
        
        const angles: number[] = [];
        for (let i = 0; i <= camera.fov; i += 2) {
            angles.push(startAngle + i * (Math.PI / 180));
        }
        pointsOfInterest.forEach(point => {
            const angle = Math.atan2(point.y - camera.y, point.x - camera.x);
            angles.push(angle - 0.001, angle, angle + 0.001);
        });

        const fovAngles = angles.filter(angle => {
            const mainAngle = (camera.rotation + 4 * Math.PI) % (2 * Math.PI);
            let delta = (angle - mainAngle + 4 * Math.PI) % (2 * Math.PI);
            if (delta > Math.PI) delta -= 2 * Math.PI;
            return Math.abs(delta) <= fovRad / 2 + 0.001;
        }).sort((a, b) => a - b);
        
        const visiblePolygonPoints: Point[] = [];
        fovAngles.forEach(angle => {
            const rayEnd = { x: camera.x + Math.cos(angle) * camera.range, y: camera.y + Math.sin(angle) * camera.range };
            let closestIntersection: Point | null = null;
            let minDistance = Infinity;

            walls.forEach(wall => {
                const intersection = getLineIntersection({x: camera.x, y: camera.y}, rayEnd, wall.p1, wall.p2);
                if (intersection) {
                    const distance = Math.hypot(intersection.x - camera.x, intersection.y - camera.y);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIntersection = intersection;
                    }
                }
            });
            if (closestIntersection && minDistance <= camera.range) {
                visiblePolygonPoints.push(closestIntersection);
            } else {
                visiblePolygonPoints.push(rayEnd);
            }
        });

        if (visiblePolygonPoints.length > 1) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
            ctx.beginPath();
            ctx.moveTo(camera.x, camera.y);
            visiblePolygonPoints.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    };

    const getLineIntersection = (p0: Point, p1: Point, p2: Point, p3: Point): Point | null => {
        const s1_x = p1.x - p0.x, s1_y = p1.y - p0.y;
        const s2_x = p3.x - p2.x, s2_y = p3.y - p2.y;
        const d = (-s2_x * s1_y + s1_x * s2_y);
        if (d === 0) return null;
        const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / d;
        const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / d;
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return { x: p0.x + (t * s1_x), y: p0.y + (t * s1_y) };
        }
        return null;
    };
    
    // Interaction Logic
    const getActionAtPosition = (x: number, y: number): ActionInfo => {
        if (selectedObject) {
            if (selectedObject.type === 'bulletCam' || selectedObject.type === 'domeCam') {
                const handleX = selectedObject.x + Math.cos(selectedObject.rotation) * 30 / viewTransform.current.scale;
                const handleY = selectedObject.y + Math.sin(selectedObject.rotation) * 30 / viewTransform.current.scale;
                if (Math.hypot(x - handleX, y - handleY) <= 8 / viewTransform.current.scale) return { type: 'rotating', object: selectedObject };
            }
            if (selectedObject.type === 'rect') {
                const handles = getRectHandles(selectedObject);
                for (const handleName in handles) {
                    const handle = handles[handleName as keyof typeof handles];
                    if (Math.hypot(x - handle.x, y - handle.y) <= HANDLE_SIZE / viewTransform.current.scale) {
                        return { type: 'resizing', handle: handleName, object: selectedObject };
                    }
                }
            }
        }
        const object = getObjectAtPosition(x, y);
        if (object) return { type: 'dragging', object };
        return { type: 'none' };
    };

    const getObjectAtPosition = (x: number, y: number): CanvasObject | null => {
        const floor = project.floors[project.activeFloorIndex];
        const ctx = canvasRef.current?.getContext('2d');
        if (!floor || !ctx) return null;
        
        for (let i = floor.layers.length - 1; i >= 0; i--) {
            const layer = floor.layers[i];
            if (!layer.visible || layer.id !== floor.activeLayerId) continue;
            for (let j = layer.objects.length - 1; j >= 0; j--) {
                const obj = layer.objects[j];
                if (obj.type === 'bulletCam' || obj.type === 'domeCam') {
                    if (Math.hypot(x - obj.x, y - obj.y) < 20 / viewTransform.current.scale) return obj;
                } else if (obj.type === 'rect') {
                    if (x > obj.x && x < obj.x + obj.w && y > obj.y && y < obj.y + obj.h) return obj;
                } else if (obj.type === 'line' || obj.type === 'wiring') {
                    if(distToSegment({x,y}, {x:obj.x1, y:obj.y1}, {x:obj.x2, y:obj.y2}) < 10 / viewTransform.current.scale) return obj;
                } else if (obj.type === 'text') {
                     ctx.font = `${obj.size}px Inter`;
                     const metrics = ctx.measureText(obj.content);
                     if (x >= obj.x && x <= obj.x + metrics.width && y >= obj.y && y <= obj.y + obj.size) return obj;
                }
            }
        }
        return null;
    };
    
    const distToSegment = (p: Point, v: Point, w: Point) => {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
        return Math.hypot(p.x - proj.x, p.y - proj.y);
    }

    const getRectHandles = (rect: RectObject) => ({
        tl: { x: rect.x, y: rect.y },
        tr: { x: rect.x + rect.w, y: rect.y },
        bl: { x: rect.x, y: rect.y + rect.h },
        br: { x: rect.x + rect.w, y: rect.y + rect.h }
    });

    const getScreenPos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent | React.WheelEvent): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if ('changedTouches' in e && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const screenToWorld = (pos: Point): Point => {
        const { x, y, scale } = viewTransform.current;
        return { x: (pos.x - x) / scale, y: (pos.y - y) / scale };
    };

    const findObjectById = (proj: Project, id: string): CanvasObject | undefined => {
        for (const floor of proj.floors) {
            for (const layer of floor.layers) {
                const found = layer.objects.find(o => o.id === id);
                if (found) return found;
            }
        }
        return undefined;
    };
    
    // Event Handlers
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const pos = getScreenPos(e.nativeEvent);

        if (('button' in e && e.button === 1) || ('touches' in e && e.touches.length === 2) || currentTool === 'movePdf') {
            lastPanPoint.current = pos;
            if (currentTool === 'movePdf') canvasRef.current!.style.cursor = 'grabbing';
            return;
        }

        const worldPos = screenToWorld(pos);
        setMouseState({ isDown: true, start: worldPos, current: worldPos });

        if (currentTool === 'select') {
            const action = getActionAtPosition(worldPos.x, worldPos.y);
            setSelectedObject(action.object || null);
            setActionInfo(action.object ? { ...action, startObjectState: JSON.parse(JSON.stringify(action.object)) } : { type: 'none' });
        } else if (currentTool === 'bulletCam' || currentTool === 'domeCam') {
            const id = `obj_${Date.now()}`;
            const newObject: CameraObject = { id, type: currentTool, x: worldPos.x, y: worldPos.y, range: 100, rotation: -Math.PI / 2, fov: 90 };
            recordUpdate(proj => {
                const floor = proj.floors[proj.activeFloorIndex];
                const layer = floor.layers.find(l => l.id === floor.activeLayerId);
                layer?.objects.push(newObject);
            });
            setCurrentTool('select');
            setSelectedObject(newObject);
            setMouseState(s => ({ ...s, isDown: false }));
        } else if (currentTool === 'text') {
            setMouseState(s => ({ ...s, isDown: false }));
            openModal({
                title: 'Adicionar Texto',
                value: 'Texto',
                onSave: (content) => {
                    if (content) {
                        const id = `obj_${Date.now()}`;
                        const newObject: TextObject = { id, type: 'text', content, x: worldPos.x, y: worldPos.y, size: 16 };
                        recordUpdate(proj => {
                             const floor = proj.floors[proj.activeFloorIndex];
                             const layer = floor.layers.find(l => l.id === floor.activeLayerId);
                             layer?.objects.push(newObject);
                        });
                        setCurrentTool('select');
                        setSelectedObject(newObject);
                    }
                }
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const nativeEvent = e.nativeEvent;
        const pos = getScreenPos(nativeEvent);
        
        if ('touches' in nativeEvent && nativeEvent.touches.length === 2) {
            const touch1 = {x: nativeEvent.touches[0].clientX, y: nativeEvent.touches[0].clientY};
            const touch2 = {x: nativeEvent.touches[1].clientX, y: nativeEvent.touches[1].clientY};
            const dist = Math.hypot(touch1.x - touch2.x, touch1.y - touch2.y);
            
            if (lastTouchDistance.current) {
                const scaleChange = dist / lastTouchDistance.current;
                const rect = canvasRef.current!.getBoundingClientRect();
                const midPoint = {
                    x: (nativeEvent.touches[0].clientX + nativeEvent.touches[1].clientX) / 2 - rect.left,
                    y: (nativeEvent.touches[0].clientY + nativeEvent.touches[1].clientY) / 2 - rect.top,
                };
                handleZoom(scaleChange, midPoint);
            }
            lastTouchDistance.current = dist;
            lastPanPoint.current = null; // Prevent panning during pinch-zoom
            return;
        }
        
        const worldPos = screenToWorld(pos);

        if (lastPanPoint.current) {
            const dx = pos.x - lastPanPoint.current.x;
            const dy = pos.y - lastPanPoint.current.y;
            if(currentTool === 'movePdf') {
                recordUpdate(proj => {
                    const floor = proj.floors[proj.activeFloorIndex];
                    if(floor.pdfBackground) {
                        floor.pdfBackground.x += dx / viewTransform.current.scale;
                        floor.pdfBackground.y += dy / viewTransform.current.scale;
                    }
                });
            } else {
                viewTransform.current.x += dx;
                viewTransform.current.y += dy;
                setMouseState(s => ({...s, current: worldPos }));
            }
            lastPanPoint.current = pos;
            return;
        }

        updateCursor(worldPos);
        if (!mouseState.isDown) return;
        
        setMouseState(s => ({ ...s, current: worldPos }));
        const { type, handle, startObjectState } = actionInfo;

        if (currentTool === 'select' && selectedObject) {
            const dx = worldPos.x - mouseState.start.x;
            const dy = worldPos.y - mouseState.start.y;
            
            if (type === 'dragging') {
                recordUpdate(proj => {
                    const obj = findObjectById(proj, selectedObject.id);
                    if(obj) {
                        if (obj.type === 'line' || obj.type === 'wiring') {
                            (obj as LineObject).x1 = startObjectState.x1 + dx; (obj as LineObject).y1 = startObjectState.y1 + dy;
                            (obj as LineObject).x2 = startObjectState.x2 + dx; (obj as LineObject).y2 = startObjectState.y2 + dy;
                        } else {
                            (obj as any).x = startObjectState.x + dx; (obj as any).y = startObjectState.y + dy;
                        }
                        setSelectedObject(obj);
                    }
                });
            } else if (type === 'rotating' && (selectedObject.type === 'bulletCam' || selectedObject.type === 'domeCam')) {
                recordUpdate(proj => {
                    const obj = findObjectById(proj, selectedObject.id) as CameraObject;
                    if(obj) {
                        obj.rotation = Math.atan2(worldPos.y - obj.y, worldPos.x - obj.x);
                        setSelectedObject(obj);
                    }
                });
            } else if (type === 'resizing' && selectedObject.type === 'rect') {
                recordUpdate(proj => {
                    const obj = findObjectById(proj, selectedObject.id) as RectObject;
                    if(obj) {
                        const { x, y, w, h } = resizeRect(startObjectState, handle!, worldPos.x, worldPos.y);
                        obj.x = x; obj.y = y; obj.w = w; obj.h = h;
                        setSelectedObject(obj);
                    }
                });
            }
        }
    };
    
    const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (lastPanPoint.current) {
             if (currentTool === 'movePdf') canvasRef.current!.style.cursor = 'grab';
        }
        lastPanPoint.current = null;
        lastTouchDistance.current = null;
        if (!mouseState.isDown) return;

        const endCoords = screenToWorld(getScreenPos(e.nativeEvent));
        
        if (actionInfo.type === 'resizing' && selectedObject?.type === 'rect') {
            recordUpdate(proj => {
                const obj = findObjectById(proj, selectedObject.id) as RectObject;
                if(obj) {
                  if (obj.w < 0) { obj.x += obj.w; obj.w *= -1; }
                  if (obj.h < 0) { obj.y += obj.h; obj.h *= -1; }
                  setSelectedObject(obj);
                }
            });
        } else if (currentTool !== 'select' && currentTool !== 'movePdf' && !currentTool.includes('Cam') && currentTool !== 'text') {
            const id = `obj_${Date.now()}`;
            let newObject: CanvasObject | null = null;
            const w = endCoords.x - mouseState.start.x;
            const h = endCoords.y - mouseState.start.y;

            if (currentTool === 'rect' && (Math.abs(w) > 5 || Math.abs(h) > 5)) {
                newObject = { id, type: 'rect', x: w > 0 ? mouseState.start.x : endCoords.x, y: h > 0 ? mouseState.start.y : endCoords.y, w: Math.abs(w), h: Math.abs(h) };
            } else if ((currentTool === 'line' || currentTool === 'wiring') && Math.hypot(w, h) > 5) {
                newObject = { id, type: currentTool, x1: mouseState.start.x, y1: mouseState.start.y, x2: endCoords.x, y2: endCoords.y };
            }

            if (newObject) {
                recordUpdate(proj => {
                    const floor = proj.floors[proj.activeFloorIndex];
                    const layer = floor.layers.find(l => l.id === floor.activeLayerId);
                    layer?.objects.push(newObject);
                });
            }
        }
        
        setMouseState({ isDown: false, start: {x:0, y:0}, current: {x:0, y:0}});
        setActionInfo({ type: 'none' });
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        handleZoom(scaleFactor, getScreenPos(e));
    };

    const handleZoom = (zoomFactor: number, center?: Point) => {
        const scale = viewTransform.current.scale;
        const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
    
        if (newScale === scale) {
            return; // Avoid unnecessary re-renders if zoom is at min/max
        }
    
        const canvas = canvasRef.current!;
        const zoomCenter = center || { x: canvas.width / 2, y: canvas.height / 2 };
    
        const worldPosBeforeZoom = screenToWorld(zoomCenter);
        
        viewTransform.current.scale = newScale;
    
        // Recalculate translation to keep the point under the cursor stationary
        viewTransform.current.x = zoomCenter.x - worldPosBeforeZoom.x * newScale;
        viewTransform.current.y = zoomCenter.y - worldPosBeforeZoom.y * newScale;
        
        // Force a re-render to apply the new transform
        setMouseState(s => ({ ...s }));
    };

    const updateCursor = (pos: Point) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let cursor = 'default';
        if (currentTool === 'select') {
            const action = getActionAtPosition(pos.x, pos.y);
            if (action.type === 'dragging') cursor = 'move';
            else if (action.type === 'rotating') cursor = 'alias';
            else if (action.type === 'resizing') {
                 if (action.handle === 'tl' || action.handle === 'br') cursor = 'nwse-resize';
                 else cursor = 'nesw-resize';
            } else if (getObjectAtPosition(pos.x, pos.y)) {
                cursor = 'pointer';
            }
        } else if (currentTool === 'movePdf') {
            cursor = 'grab';
        } else if (currentTool.includes('Cam') || currentTool === 'text') {
            cursor = 'copy';
        } else {
            cursor = 'crosshair';
        }
        canvas.style.cursor = cursor;
    };
    
    const resizeRect = (rect: RectObject, handle: string, mx: number, my: number) => {
        let { x, y, w, h } = rect;
        switch (handle) {
            case 'tl': w += x - mx; h += y - my; x = mx; y = my; break;
            case 'tr': w = mx - x; h += y - my; y = my; break;
            case 'bl': w += x - mx; h = my - y; x = mx; break;
            case 'br': w = mx - x; h = my - y; break;
        }
        return { x, y, w, h };
    };

    const deleteSelectedObject = () => {
        if (!selectedObject) return;
        recordUpdate(proj => {
            proj.floors.forEach(floor => {
                floor.layers.forEach(layer => {
                    layer.objects = layer.objects.filter(o => o.id !== selectedObject.id);
                });
            });
        });
        setSelectedObject(null);
    };

    const saveProject = () => {
        const dataStr = JSON.stringify(project, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'project.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const newProject = JSON.parse(event.target?.result as string) as Project;
                    setHistory([newProject]);
                    setHistoryIndex(0);
                    setSelectedObject(null);
                } catch (err) {
                    console.error("Error loading project file:", err);
                    alert("Failed to load project file. It may be corrupted.");
                }
            };
            reader.readAsText(file);
        }
        e.target.value = '';
    };

    const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileReader = new FileReader();
        fileReader.onload = async (event) => {
            const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const context = canvas.getContext('2d');
            if(!context) return;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const dataUrl = canvas.toDataURL();
            const newImg = new Image();
            newImg.onload = () => {
                pdfImageCache.current[dataUrl] = newImg;
                recordUpdate(proj => {
                    proj.floors[proj.activeFloorIndex].pdfBackground = {
                        data: dataUrl,
                        width: newImg.width,
                        height: newImg.height,
                        x: 0,
                        y: 0
                    };
                });
            };
            newImg.src = dataUrl;
        };
        fileReader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const exportToPdf = () => {
        const floor = project.floors[project.activeFloorIndex];
        const allVisibleObjects = floor.layers.flatMap(l => l.visible ? l.objects : []);
        if (allVisibleObjects.length === 0 && !floor.pdfBackground) {
            alert("Nothing to export.");
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (floor.pdfBackground) {
            minX = Math.min(minX, floor.pdfBackground.x);
            minY = Math.min(minY, floor.pdfBackground.y);
            maxX = Math.max(maxX, floor.pdfBackground.x + floor.pdfBackground.width);
            maxY = Math.max(maxY, floor.pdfBackground.y + floor.pdfBackground.height);
        }
        allVisibleObjects.forEach(o => {
            if ('x' in o && 'y' in o) {
                const w = (o as any).w || 0;
                const h = (o as any).h || 0;
                minX = Math.min(minX, o.x);
                minY = Math.min(minY, o.y);
                maxX = Math.max(maxX, o.x + w);
                maxY = Math.max(maxY, o.y + h);
            } else if ('x1' in o) {
                minX = Math.min(minX, o.x1, (o as LineObject).x2);
                minY = Math.min(minY, o.y1, (o as LineObject).y2);
                maxX = Math.max(maxX, o.x1, (o as LineObject).x2);
                maxY = Math.max(maxY, o.y1, (o as LineObject).y2);
            }
        });

        const padding = 50;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = contentWidth;
        tempCanvas.height = contentHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, contentWidth, contentHeight);

        tempCtx.save();
        tempCtx.translate(-minX + padding, -minY + padding);
        
        if (floor.pdfBackground && pdfImageCache.current[floor.pdfBackground.data]) {
            tempCtx.drawImage(pdfImageCache.current[floor.pdfBackground.data], floor.pdfBackground.x, floor.pdfBackground.y);
        }
        allVisibleObjects.forEach(obj => drawObject(tempCtx, obj));
        tempCtx.restore();

        const imgData = tempCanvas.toDataURL('image/jpeg', 0.9);
        const pdf = new jspdf.jsPDF({
            orientation: contentWidth > contentHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [contentWidth, contentHeight]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, contentWidth, contentHeight);
        pdf.save(`${floor.name}_export.pdf`);
    };

    const toolbarProps = {
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
        canUndo: historyIndex > 0,
    };

    const tabsProps = {
        project,
        recordUpdate,
        setSelectedObject,
        openModal,
    };

    const rightPanelProps = {
        project,
        recordUpdate,
        selectedObject,
        setSelectedObject,
        openModal,
        isVisible: isRightPanelVisible,
        toggleVisibility: () => setRightPanelVisible(v => !v),
    };

    return (
        <div className="h-screen w-screen bg-gray-100 flex flex-col font-sans text-gray-800">
            <main className="flex flex-1 overflow-hidden">
                <Toolbar {...toolbarProps} />
                <div className="flex-1 flex flex-col relative">
                    <Tabs {...tabsProps} />
                    <section 
                        ref={mainContainerRef} 
                        className="flex-1 relative bg-gray-50 border-t border-gray-300 overflow-hidden"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        onTouchStart={handleMouseDown}
                        onTouchMove={handleMouseMove}
                        onTouchEnd={handleMouseUp}
                    >
                        <canvas ref={canvasRef} className="absolute top-0 left-0" />
                        <div className="absolute bottom-4 right-20 flex flex-col space-y-1 bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-md border border-gray-200 pointer-events-auto">
                             <button 
                                onClick={() => handleZoom(1.2)} 
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 hover:bg-gray-200 rounded-md transition-colors" 
                                aria-label="Zoom In"
                             >
                                <Icon svg={ICONS.zoomIn} />
                             </button>
                             <button 
                                onClick={() => handleZoom(1 / 1.2)} 
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 hover:bg-gray-200 rounded-md transition-colors" 
                                aria-label="Zoom Out"
                            >
                                <Icon svg={ICONS.zoomOut} />
                            </button>
                        </div>
                    </section>
                    <RightPanel {...rightPanelProps} />
                </div>
            </main>
            {isModalVisible && <InputModal 
                title={modalConfig.title} 
                initialValue={modalConfig.value} 
                onClose={() => setModalVisible(false)} 
                onSave={(value) => { 
                    modalConfig.onSave(value); 
                    setModalVisible(false); 
                }} 
            />}
        </div>
    );
}
