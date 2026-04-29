"use client";

import React, { useState, useCallback, useMemo, useEffect, startTransition, useLayoutEffect, createContext, useContext } from "react";
import { ReactFlow, Background, useNodesState, useEdgesState, addEdge, Handle, Position, ReactFlowProvider, BackgroundVariant, Node, Edge, useReactFlow } from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus,
  Sparkles, 
  RefreshCw,  
  Map as MapIcon, 
  Circle,
  Sun,
  Moon,
  Settings,
  RotateCcw,
  ImageDown,
  Expand,
  Briefcase,
  Coffee,
  Zap,
  Flame,
  Heart,
  ChevronsLeft,
  Equal,
  ChevronsRight,
  Target,
  Maximize
} from "lucide-react";
import { toPng } from "html-to-image";

// --- Types & Context ---
const CanvasContext = createContext<{
  updateNodeText: (id: string, text: string) => void;
  reactivateNode: (id: string) => void;
  generateOptions: (tone: string, length: string, direction: "left" | "right") => void;
  selectVersion: (id: string) => void;
  hasActiveCandidates: boolean;
  showPathNumbers: boolean;
} | null>(null);

const toneOptions = [
  { label: "Professional", Icon: Briefcase },
  { label: "Casual",       Icon: Coffee },
  { label: "Witty",        Icon: Zap },
  { label: "Punchy",       Icon: Flame },
  { label: "Empathetic",   Icon: Heart },
];

const lengthOptions = [
  { label: "Short",  Icon: ChevronsLeft },
  { label: "Medium", Icon: Equal },
  { label: "Long",   Icon: ChevronsRight },
];

// --- Components ---

const CenterViewButton = () => {
  const { fitView } = useReactFlow();
  return (
    <div className="fab" onClick={() => fitView({ duration: 800, padding: 0.2 })} title="Center View">
      <Maximize size={18} />
    </div>
  );
};

const ExpandingButton = ({ opt, onClick, expandDir = "left" }: { opt: any, onClick: () => void, expandDir?: "left" | "right" }) => {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="nodrag"
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: expandDir === "left" ? "row" : "row-reverse",
        gap: 0,
        height: "36px",
        borderRadius: "18px",
        background: "var(--surface)",
        backdropFilter: "blur(16px)",
        border: "1px solid var(--line-strong)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        padding: "0 10px",
        cursor: "pointer",
        overflow: "hidden",
        whiteSpace: "nowrap",
        transition: "all 0.25s cubic-bezier(0.32,0.72,0,1)",
        minWidth: "36px",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-strong)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
    >
      <opt.Icon size={13} strokeWidth={2.5} style={{ color: "var(--foreground)", opacity: 0.8, flexShrink: 0 }} />
      <span style={{
        maxWidth: 0,
        overflow: "hidden",
        fontSize: "0.58rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--foreground)",
        opacity: 0,
        transition: "max-width 0.25s ease, opacity 0.2s ease, margin 0.25s ease",
        marginLeft: expandDir === "left" ? 0 : 0,
        marginRight: expandDir === "left" ? 0 : 0,
      }}
      className="toolbar-label"
      >
        {opt.label}
      </span>
    </button>
  );
};

const LabeledEdge = ({ id, sourceX, sourceY, targetX, targetY, data, style, markerEnd }: any) => {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const isUpsideDown = Math.abs(angle) > 90;

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={(() => {
        const cx = Math.max(80, Math.abs(dx) * 0.5);
        const cy = dy * 0.15;
        return `M${sourceX},${sourceY} C${sourceX + cx},${sourceY + cy} ${targetX - cx},${targetY - cy} ${targetX},${targetY}`;
      })()} markerEnd={markerEnd} />
      {(data?.isSolid || (data?.showLabel && !data?.isCandidate)) && (
        <foreignObject
          width={240}
          height={60}
          x={midX - 120}
          y={midY - 30}
          className="edge-label-container"
        >
          <div className="flex items-center justify-center w-full h-full">
            <div 
              className={`edge-pill-wrapper ${dist < 220 ? 'is-compact' : ''}`}
              style={{ transform: `rotate(${isUpsideDown ? angle + 180 : angle}deg)` }}
            >
              <div className="edge-pill">
                <span className="step-num">{data?.label || 1}</span>
                <span className="step-text">{data?.promptText || "Branch"}</span>
              </div>
            </div>
          </div>
        </foreignObject>
      )}
    </>
  );
};

const GlassNode = ({ id, data }: any) => {
  const { updateNodeText, generateOptions, selectVersion, hasActiveCandidates, showPathNumbers } = useContext(CanvasContext)!;
  const [isHoveringLeft, setIsHoveringLeft] = useState(false);
  const [isHoveringRight, setIsHoveringRight] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<"visible" | "slidingOut" | "hidden">("visible");
  const [hasPreviewed, setHasPreviewed] = useState(false);

  const adjustHeight = () => {
    const el = document.getElementById(`textarea-${id}`);
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useLayoutEffect(() => {
    adjustHeight();
    const timeout = setTimeout(adjustHeight, 50);
    return () => clearTimeout(timeout);
  }, [data.text, data.isCandidate]);

  useEffect(() => {
    if (!data.isActive || data.isCandidate) return;
    
    const wordCount = (data.text || "").trim().split(/\s+/).filter(Boolean).length;
    
    if (wordCount >= 2 && !hasPreviewed) {
      setHasPreviewed(true);
      setPreviewPhase("slidingOut");
      
      const hideTimer = setTimeout(() => {
        setPreviewPhase("hidden");
      }, 2500);
      
      return () => clearTimeout(hideTimer);
    }
  }, [data.text, data.isActive, hasPreviewed, data.isCandidate]);

  if (data.isCandidate) {
    return (
      <div className={`node-wrapper ${data.isDiscarded ? "opacity-30 grayscale pointer-events-auto" : ""}`}>
        <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
        
        <div 
          className="node-box glass is-candidate" 
          onClick={() => selectVersion(id)}
        >
          <div className="candidate-label">
            <Sparkles size={10} />
            <span>0{data.candidateIndex + 1}</span>
          </div>
          <p>{data.text}</p>
        </div>
      </div>
    );
  }

  const showLeftToolbar = data.isActive && !hasActiveCandidates && data.status !== "loading" && (previewPhase === "slidingOut" || isHoveringLeft);
  const showRightToolbar = data.isActive && !hasActiveCandidates && data.status !== "loading" && (previewPhase === "slidingOut" || isHoveringRight);
  const showHitboxes = data.isActive && previewPhase === "hidden" && !hasActiveCandidates && data.status !== "loading";

  return (
    <div className={`node-wrapper ${data.isActive ? "active" : "past"}`}>
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
      
      <div 
        className="hitbox-left" 
        onMouseEnter={() => showHitboxes && setIsHoveringLeft(true)}
        onMouseLeave={() => setIsHoveringLeft(false)}
        style={{ pointerEvents: showLeftToolbar || showHitboxes || isHoveringLeft ? 'auto' : 'none' }}
      >
        <AnimatePresence>
          {showLeftToolbar && (
            <motion.div 
              className="toolbar-left nodrag"
              initial={{ opacity: 0, x: 20, y: "-50%" }}
              animate={{ opacity: 1, x: 0, y: "-50%" }}
              exit={{ opacity: 0, x: 20, y: "-50%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              {toneOptions.map(opt => (
                <ExpandingButton key={opt.label} opt={opt} expandDir="left" onClick={() => generateOptions(opt.label, "Same length", "left")} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div 
        className="hitbox-right" 
        onMouseEnter={() => showHitboxes && setIsHoveringRight(true)}
        onMouseLeave={() => setIsHoveringRight(false)}
        style={{ pointerEvents: showRightToolbar || showHitboxes || isHoveringRight ? 'auto' : 'none' }}
      >
        <AnimatePresence>
          {showRightToolbar && (
            <motion.div 
              className="toolbar-right nodrag"
              initial={{ opacity: 0, x: -20, y: "-50%" }}
              animate={{ opacity: 1, x: 0, y: "-50%" }}
              exit={{ opacity: 0, x: -20, y: "-50%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              {lengthOptions.map(opt => (
                <ExpandingButton key={opt.label} opt={opt} expandDir="right" onClick={() => generateOptions("Professional", opt.label, "right")} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`node-box glass ${data.status === 'loading' ? 'is-loading' : ''} ${data.status === 'success' ? 'is-success' : ''}`}>
        <div className="node-header">
          <div className="flex items-center gap-2">
            <div className={`status-dot ${data.status}`} />
            {showPathNumbers && <span className="text-[0.6rem] font-bold uppercase tracking-widest opacity-40">Step 0{data.stepNumber || 1}</span>}
          </div>
        </div>
        
        <textarea
          id={`textarea-${id}`}
          className="node-input nodrag"
          value={data.text}
          onChange={(e) => updateNodeText(id, e.target.value)}
          placeholder="Type your copy here..."
          autoFocus={data.isActive}
        />
      </div>
    </div>
  );
};

// --- Main App ---

const nodeTypes = { glassNode: GlassNode };
const edgeTypes = { labeledEdge: LabeledEdge };

export default function SpatialChain() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}

function FlowApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isPending, startTransition] = React.useTransition();
  const [activeNodeId, setActiveNodeId] = useState<string>("root");
  
  const [hasActiveCandidates, setHasActiveCandidates] = useState(false);
  const [showPathNumbers, setShowPathNumbers] = useState(false);
  const [theme, setTheme] = useState<"light" | "warm" | "dark">("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  
  const [userContext, setUserContext] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  useEffect(() => {
    setNodes([{
      id: "root",
      type: "glassNode",
      position: { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 100 },
      data: { text: "", isActive: true, status: "idle", isCandidate: false, stepNumber: 1 },
    }]);
  }, [setNodes]);

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)));
  }, [setNodes]);

  const setNodeStatus = useCallback((id: string, status: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)));
  }, [setNodes]);

  const generateOptions = useCallback((tone: string, length: string, direction: "left" | "right") => {
    const activeNode = nodes.find((n) => n.id === activeNodeId);
    if (!activeNode || !activeNode.data.text || isPending) return;

    setNodeStatus(activeNodeId, "loading");
    
    startTransition(async () => {
      try {
        const response = await fetch("/api/generate-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentText: activeNode.data.text as string,
            tone,
            length,
            userContext,
            recentSteps: [],
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "AI error");
        
        setNodeStatus(activeNodeId, "success");
        setTimeout(() => setNodeStatus(activeNodeId, "idle"), 1500);

        const newIds = data.outputOptions.map(() => Math.random().toString(36).substr(2, 9));
        
        const activeCandidates = nodes.filter(n => n.data.isCandidate && n.data.parentId === activeNodeId && !n.data.isDiscarded);
        const willUpdateInPlace = activeCandidates.length === data.outputOptions.length;

        const promptText = (tone && tone !== "Original") ? tone : "Variation";

        setNodes(currentNodes => {
          const activeCandidates = currentNodes.filter(n => n.data.isCandidate && n.data.parentId === activeNodeId && !n.data.isDiscarded);
          if (activeCandidates.length === data.outputOptions.length) {
            return currentNodes.map(n => {
              const d = n.data as any;
              if (d.isCandidate && d.parentId === activeNodeId && !d.isDiscarded) {
                return { ...n, data: { ...d, text: data.outputOptions[d.candidateIndex] } };
              }
              return n;
            });
          }

          const NODE_W = 440; 
          const NODE_H = 200; 
          const GAP_X = 110;  
          const GAP_Y = 40;   

          const rightX = activeNode.position.x + NODE_W + GAP_X;
          const leftX  = activeNode.position.x - NODE_W - GAP_X;

          const countNodesNear = (x: number) =>
            currentNodes.filter(n => Math.abs(n.position.x - x) < NODE_W).length;

          const rightCount = countNodesNear(rightX);
          const leftCount  = countNodesNear(leftX);
          const finalDirection =
            direction === "right" && rightCount <= leftCount + 1 ? "right" :
            direction === "left"  && leftCount  <= rightCount + 1 ? "left" :
            rightCount <= leftCount ? "right" : "left";

          const columnX = finalDirection === "right" ? rightX : leftX;

          const occupiedRects = currentNodes.map(n => ({
            x: n.position.x,
            y: n.position.y,
            w: NODE_W,
            h: NODE_H,
          }));

          const isRectFree = (y: number) =>
            !occupiedRects.some(r =>
              columnX < r.x + r.w + GAP_X &&
              columnX + NODE_W + GAP_X > r.x &&
              y < r.y + r.h + GAP_Y &&
              y + NODE_H + GAP_Y > r.y
            );

          const STEP = NODE_H + GAP_Y;
          const candidateCount = data.outputOptions.length;
          const centerY = activeNode.position.y - Math.floor(candidateCount / 2) * STEP;

          const placedYs: number[] = [];

          for (let i = 0; i < candidateCount; i++) {
            let preferred = centerY + i * STEP;
            let y = preferred;
            let tries = 0;
            while (!isRectFree(y) && tries < 40) {
              y = preferred + (tries % 2 === 0 ? 1 : -1) * Math.ceil((tries + 1) / 2) * STEP;
              tries++;
            }
            placedYs.push(y);
            occupiedRects.push({ x: columnX, y, w: NODE_W, h: NODE_H });
          }

            const activeData = activeNode.data as any;
            const newNodes = data.outputOptions.map((opt: string, i: number) => ({
              id: newIds[i],
              type: "glassNode",
              position: { x: columnX, y: placedYs[i] },
              data: { 
                text: opt, 
                isActive: false, 
                isCandidate: true, 
                candidateIndex: i, 
                parentId: activeNodeId,
                status: "idle",
                stepNumber: (activeData.stepNumber || 1) + 1
              },
            }));

          return [...currentNodes, ...newNodes];
        });

        if (!willUpdateInPlace) {
          setEdges(eds => {
            const newEds = [...eds];
            newIds.forEach((newId: string) => {
              newEds.push({
                id: `e-${activeNodeId}-${newId}`,
                source: activeNodeId,
                target: newId,
                type: "labeledEdge",
                sourceHandle: direction === "right" ? "right" : "left",
                targetHandle: direction === "right" ? "left" : "right",
                animated: true,
                style: { strokeDasharray: "5 5", stroke: "var(--line-strong)", opacity: 0.6, strokeWidth: 2 },
                data: { label: (activeNode.data as any).stepNumber || 1, promptText, isSolid: false, showLabel: showPathNumbers, isCandidate: true }
              });
            });
            return newEds;
          });
        }
        setHasActiveCandidates(true);

      } catch (e) {
        setNodeStatus(activeNodeId, "idle");
        showNotice(e instanceof Error ? e.message : "Error generating options");
      }
    });
  }, [activeNodeId, isPending, nodes, setNodeStatus, userContext, setNodes, setEdges, showPathNumbers]);

  const selectVersion = useCallback((selectedId: string) => {
    const selectedNode = nodes.find(n => n.id === selectedId);
    if (!selectedNode || !selectedNode.data.parentId) return;

    const parentId = selectedNode.data.parentId;

    setNodes(nds => nds.map(n => {
      if (n.id === selectedId) {
        return { ...n, data: { ...n.data, isCandidate: false, isActive: true, isDiscarded: false } };
      }
      if (n.data.parentId === parentId && n.data.isCandidate) {
        return { ...n, data: { ...n.data, isDiscarded: true, isActive: false } };
      }
      if (n.id === parentId) {
        return { ...n, data: { ...n.data, isActive: false } };
      }
      return { ...n, data: { ...n.data, isActive: false } };
    }));

    setEdges(eds => eds.map(e => {
      if (e.target === selectedId) {
        return { ...e, animated: false, style: { stroke: "var(--foreground)", opacity: 0.5, strokeWidth: 2.5 }, data: { ...e.data, isSolid: true, isCandidate: false } };
      }
      if (e.source === parentId && e.target !== selectedId) {
        return { ...e, animated: false, style: { stroke: "var(--line-strong)", opacity: 0.1, strokeWidth: 1 }, data: { ...e.data, isSolid: false, isCandidate: true } };
      }
      return e;
    }));

    setActiveNodeId(selectedId);
    setHasActiveCandidates(false);
  }, [nodes, setNodes, setEdges]);

  const resetAll = useCallback(() => {
    setNodes([{
      id: "root",
      type: "glassNode",
      position: { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 100 },
      data: { text: "", isActive: true, status: "idle", isCandidate: false, stepNumber: 1 },
    }]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const exportImage = async () => {
    const el = document.querySelector(".copy-canvas-container") as HTMLElement;
    if (!el) return;
    const url = await toPng(el, { backgroundColor: "#f8fafc" });
    const link = document.createElement("a");
    link.download = "copy-spatial.png";
    link.href = url;
    link.click();
  };

  const contextValue = {
    updateNodeText,
    reactivateNode: (id: string) => setActiveNodeId(id),
    generateOptions,
    selectVersion,
    hasActiveCandidates,
    showPathNumbers,
  };

  return (
      <CanvasContext.Provider value={contextValue}>
        <div className="copy-canvas-container">
          <div className="brand" style={{ display: 'flex', alignItems: 'center' }}>
            Copy Chain 
            <span style={{ 
              fontSize: '0.42rem', 
              padding: '2px 5px', 
              background: 'var(--foreground)', 
              color: 'var(--background)',
              borderRadius: '4px', 
              letterSpacing: '0.08em',
              fontWeight: 900,
              marginLeft: '8px',
              verticalAlign: 'middle',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1
            }}>ALPHA</span>
          </div>

          <div className="corner-actions bottom-left">
            <CenterViewButton />
          </div>

          <div className="corner-actions top-right">
            <div className="fab" onClick={() => {
              if (theme === 'light') setTheme('warm');
              else if (theme === 'warm') setTheme('dark');
              else setTheme('light');
            }} title="Toggle Theme">
              {theme === 'light' && <Circle className="w-5 h-5 opacity-50" />}
              {theme === 'warm' && <Sun className="w-5 h-5 text-amber-700" />}
              {theme === 'dark' && <Moon className="w-5 h-5 text-slate-400" fill="currentColor" />}
            </div>
            <div className={`fab ${showPathNumbers ? "bg-black text-white" : ""}`} onClick={() => setShowPathNumbers(!showPathNumbers)} title="Toggle Path Labels"><MapIcon /></div>
            <div className="fab" onClick={resetAll} title="Reset Canvas"><RotateCcw /></div>
            <div className="fab" onClick={exportImage} title="Export PNG"><ImageDown /></div>
            <div className="fab" onClick={() => document.documentElement.requestFullscreen()} title="Fullscreen"><Expand /></div>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 0.95 }}
          >
            <Background gap={40} color="var(--line)" variant={BackgroundVariant.Lines} />
          </ReactFlow>

          {/* Text Bank — Morphing UI Component */}
          {/* Text Bank — Morphing UI Component */}
          <motion.div
            layout
            initial={false}
            animate={{
              width: contextOpen ? 340 : 130,
              height: contextOpen ? 280 : 44,
              borderRadius: contextOpen ? 24 : 22,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ 
              position: 'fixed',
              right: '40px', 
              bottom: '32px',
              zIndex: 2000,
              background: "var(--surface)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border: "1px solid var(--line-strong)",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.2)",
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <AnimatePresence mode="wait">
              {!contextOpen ? (
                <motion.div
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--foreground)',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setContextOpen(true)}
                >
                  {userContext ? "✦ Text Bank" : "Text Bank"}
                </motion.div>
              ) : (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.4 }}>Text Bank</span>
                    <div 
                      onClick={() => setContextOpen(false)}
                      style={{ cursor: 'pointer', opacity: 0.3, padding: '4px' }}
                    >
                      <Plus className="rotate-45" size={16} />
                    </div>
                  </div>
                  
                  <textarea
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.04)",
                      borderRadius: 12,
                      padding: "16px",
                      fontSize: "0.85rem",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      flexGrow: 1,
                      fontFamily: "inherit",
                      color: "var(--foreground)",
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    placeholder="Voice, audience, banned words..."
                    autoFocus
                  />
                  
                  <button
                    onClick={() => setContextOpen(false)}
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: "var(--foreground)",
                      color: "var(--background)",
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Save Changes
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {notice && (
              <motion.div 
                className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-full text-sm font-bold shadow-2xl z-[2000]"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CanvasContext.Provider>
  );
}
