"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, createContext, useContext, useRef } from "react";
import { ReactFlow, Background, useNodesState, useEdgesState, addEdge, Handle, Position, ReactFlowProvider, BackgroundVariant, Node, Edge, useReactFlow } from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sparkles,
  Circle,
  Sun,
  Moon,
  RotateCcw,
  ImageDown,
  Expand,
  Briefcase,
  Coffee,
  Zap,
  Flame,
  Heart,
  ChevronsDown,
  Equal,
  ChevronsUp,
  Maximize,
  Map as MapIcon,
} from "lucide-react";
import { toPng } from "html-to-image";

// --- Types & Context ---
const CanvasContext = createContext<{
  updateNodeText: (id: string, text: string) => void;
  reactivateNode: (id: string) => void;
  generateFromNode: (id: string, tone: string, length: string, direction: "left" | "right") => void;
  selectVersion: (id: string) => void;
  activeNodeId: string;
  isGenerating: boolean;
} | null>(null);

const toneOptions = [
  { label: "Professional", Icon: Briefcase },
  { label: "Casual", Icon: Coffee },
  { label: "Witty", Icon: Zap },
  { label: "Punchy", Icon: Flame },
  { label: "Empathetic", Icon: Heart },
];

const lengthOptions = [
  { label: "Shorter", Icon: ChevronsDown },
  { label: "Same", Icon: Equal },
  { label: "Longer", Icon: ChevronsUp },
];

// --- Storage ---
const STORAGE_KEY = "copychain-state";

function saveToStorage(nodes: Node[], edges: Edge[], userContext: string, theme: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, userContext, theme, ts: Date.now() }));
  } catch {}
}

function loadFromStorage(): { nodes: Node[]; edges: Edge[]; userContext: string; theme: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.nodes?.length > 0) return data;
  } catch {}
  return null;
}

// --- Edge Component ---
const LabeledEdge = ({ id, sourceX, sourceY, targetX, targetY, data, style, markerEnd }: any) => {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const isUpsideDown = Math.abs(angle) > 90;

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={(() => {
        const cx = Math.max(80, Math.abs(dx) * 0.5);
        const cy = dy * 0.15;
        return `M${sourceX},${sourceY} C${sourceX + cx},${sourceY + cy} ${targetX - cx},${targetY - cy} ${targetX},${targetY}`;
      })()} markerEnd={markerEnd} />
      {data?.promptText && (
        <foreignObject width={200} height={40} x={midX - 100} y={midY - 20} style={{ overflow: "visible", pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <div style={{
              transform: `rotate(${isUpsideDown ? angle + 180 : angle}deg)`,
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--surface-strong)", backdropFilter: "blur(12px)",
              border: "1px solid var(--line-strong)", padding: "3px 10px",
              borderRadius: 99, whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <span style={{
                background: "var(--foreground)", color: "var(--background)",
                width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", fontSize: "0.45rem", fontWeight: 900, flexShrink: 0,
              }}>{data?.label || 1}</span>
              <span style={{
                fontSize: "0.55rem", fontWeight: 800, textTransform: "uppercase",
                letterSpacing: "0.08em", color: "var(--foreground)", opacity: 0.7,
              }}>{data.promptText}</span>
            </div>
          </div>
        </foreignObject>
      )}
    </>
  );
};

// --- Node Component ---
const GlassNode = ({ id, data }: any) => {
  const ctx = useContext(CanvasContext)!;
  const isActive = id === ctx.activeNodeId;
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [selectedLength, setSelectedLength] = useState<string | null>(null);

  const adjustHeight = () => {
    const el = document.getElementById(`textarea-${id}`);
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  };

  useLayoutEffect(() => {
    adjustHeight();
    const t = setTimeout(adjustHeight, 50);
    return () => clearTimeout(t);
  }, [data.text, data.isCandidate]);

  useEffect(() => {
    if (isActive) { setSelectedTone(null); setSelectedLength(null); }
  }, [isActive]);

  const hasText = (data.text || "").trim().length > 0;
  const showToolbar = isActive && hasText && !data.isCandidate && data.status !== "loading";

  const handleGenerate = (tone: string, length: string) => {
    ctx.generateFromNode(id, tone, length, "right");
  };

  const handleToneClick = (tone: string) => {
    setSelectedTone(tone);
    if (selectedLength) handleGenerate(tone, selectedLength);
  };

  const handleLengthClick = (length: string) => {
    setSelectedLength(length);
    if (selectedTone) handleGenerate(selectedTone, length);
  };

  // Candidate node
  if (data.isCandidate) {
    return (
      <div className={`node-wrapper ${data.isDiscarded ? "is-discarded" : ""}`}>
        <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
        <div className="node-box glass is-candidate" onClick={() => !data.isDiscarded && ctx.selectVersion(id)}>
          <div className="candidate-label">
            <Sparkles size={10} />
            <span>Option {data.candidateIndex + 1}</span>
          </div>
          <p>{data.text}</p>
          {!data.isDiscarded && (
            <div className="candidate-hint">Click to use this version</div>
          )}
        </div>
      </div>
    );
  }

  // Regular node
  return (
    <div className={`node-wrapper ${isActive ? "active" : "past"}`}>
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />

      <div
        className={`node-box glass ${data.status === "loading" ? "is-loading" : ""} ${data.status === "success" ? "is-success" : ""} ${!isActive ? "is-past" : ""}`}
        onClick={() => { if (!isActive) ctx.reactivateNode(id); }}
      >
        <div className="node-header">
          <div className="node-header-left">
            <div className={`status-dot ${data.status || "idle"}`} />
            {data.stepNumber > 1 && <span className="step-label">Step {data.stepNumber}</span>}
          </div>
          {!isActive && <span className="click-hint">Click to edit</span>}
        </div>

        <textarea
          id={`textarea-${id}`}
          className="node-input nodrag"
          value={data.text}
          onChange={(e) => ctx.updateNodeText(id, e.target.value)}
          placeholder={isActive ? "Paste or type your copy here...\n\nA headline, email, ad copy, tweet — anything you want to rewrite." : ""}
          autoFocus={isActive}
          readOnly={!isActive}
        />

        {/* Inline toolbar */}
        <AnimatePresence>
          {showToolbar && (
            <motion.div
              className="inline-toolbar nodrag"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="toolbar-section">
                <span className="toolbar-label-text">Tone</span>
                <div className="toolbar-chips">
                  {toneOptions.map(opt => (
                    <button
                      key={opt.label}
                      className={`chip ${selectedTone === opt.label ? "selected" : ""}`}
                      onClick={(e) => { e.stopPropagation(); handleToneClick(opt.label); }}
                    >
                      <opt.Icon size={12} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="toolbar-section">
                <span className="toolbar-label-text">Length</span>
                <div className="toolbar-chips">
                  {lengthOptions.map(opt => (
                    <button
                      key={opt.label}
                      className={`chip ${selectedLength === opt.label ? "selected" : ""}`}
                      onClick={(e) => { e.stopPropagation(); handleLengthClick(opt.label); }}
                    >
                      <opt.Icon size={12} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {!selectedTone && !selectedLength && (
                <div className="toolbar-hint">Pick a tone + length to generate</div>
              )}
              {(selectedTone && !selectedLength) && (
                <div className="toolbar-hint">Now pick a length</div>
              )}
              {(!selectedTone && selectedLength) && (
                <div className="toolbar-hint">Now pick a tone</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
  const [activeNodeId, setActiveNodeId] = useState<string>("root");
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState<"light" | "warm" | "dark">("light");
  const [showPathNumbers, setShowPathNumbers] = useState(true);
  const [userContext, setUserContext] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { fitView } = useReactFlow();
  const initialized = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const showNotice = useCallback((msg: string, duration = 4000) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), duration);
  }, []);

  // Init: load from storage or create root
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadFromStorage();
    if (saved) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
      setUserContext(saved.userContext || "");
      if (saved.theme) setTheme(saved.theme as any);
      const active = saved.nodes.find((n: Node) => n.data.isActive);
      if (active) setActiveNodeId(active.id);
    } else {
      setNodes([{
        id: "root",
        type: "glassNode",
        position: { x: 0, y: 0 },
        data: { text: "", isActive: true, status: "idle", isCandidate: false, stepNumber: 1 },
      }]);
    }
    setTimeout(() => fitView({ duration: 400, padding: 0.3 }), 100);
  }, [setNodes, setEdges, fitView]);

  // Auto-save
  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(() => saveToStorage(nodes, edges, userContext, theme), 500);
    return () => clearTimeout(t);
  }, [nodes, edges, userContext, theme]);

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text } } : n));
  }, [setNodes]);

  const setNodeStatus = useCallback((id: string, status: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, status } } : n));
  }, [setNodes]);

  const reactivateNode = useCallback((id: string) => {
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isActive: n.id === id } })));
    setActiveNodeId(id);
  }, [setNodes]);

  const generateFromNode = useCallback(async (nodeId: string, tone: string, length: string, direction: "left" | "right") => {
    const currentNodes = nodes;
    const activeNode = currentNodes.find(n => n.id === nodeId);
    if (!activeNode || !activeNode.data.text || isGenerating) return;

    setIsGenerating(true);
    setNodeStatus(nodeId, "loading");

    try {
      const response = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentText: activeNode.data.text as string,
          tone, length, userContext, recentSteps: [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Generation failed");

      setNodeStatus(nodeId, "success");
      setTimeout(() => setNodeStatus(nodeId, "idle"), 1500);

      const newIds = data.outputOptions.map(() => Math.random().toString(36).substr(2, 9));
      const promptText = tone;

      const NODE_W = 420;
      const NODE_H = 200;
      const GAP_X = 140;
      const GAP_Y = 40;
      const STEP = NODE_H + GAP_Y;

      setNodes(currentNodes => {
        // Discard existing candidates for this node
        const cleaned = currentNodes.map(n => {
          if (n.data.isCandidate && n.data.parentId === nodeId) {
            return { ...n, data: { ...n.data, isDiscarded: true } };
          }
          return n;
        });

        const rightX = activeNode.position.x + NODE_W + GAP_X;
        const leftX = activeNode.position.x - NODE_W - GAP_X;

        const countNodesNear = (x: number) =>
          cleaned.filter(n => Math.abs(n.position.x - x) < NODE_W && !n.data.isDiscarded).length;
        const rightCount = countNodesNear(rightX);
        const leftCount = countNodesNear(leftX);
        const finalDir = rightCount <= leftCount ? "right" : "left";
        const columnX = finalDir === "right" ? rightX : leftX;

        const candidateCount = data.outputOptions.length;
        const centerY = activeNode.position.y - Math.floor(candidateCount / 2) * STEP;
        const activeData = activeNode.data as any;

        const newNodes = data.outputOptions.map((opt: string, i: number) => ({
          id: newIds[i],
          type: "glassNode",
          position: { x: columnX, y: centerY + i * STEP },
          data: {
            text: opt, isActive: false, isCandidate: true,
            candidateIndex: i, parentId: nodeId, status: "idle",
            stepNumber: (activeData.stepNumber || 1) + 1,
          },
        }));

        return [...cleaned, ...newNodes];
      });

      // Remove old candidate edges, add new ones
      setEdges(eds => {
        const cleaned = eds.filter(e => !(e.source === nodeId && e.data?.isCandidate));
        const newEdges = newIds.map((newId: string) => ({
          id: `e-${nodeId}-${newId}`,
          source: nodeId,
          target: newId,
          type: "labeledEdge",
          sourceHandle: "right",
          targetHandle: "left",
          animated: true,
          style: { stroke: "var(--foreground)", opacity: 0.15, strokeWidth: 2 },
          data: { label: (activeNode.data as any).stepNumber || 1, promptText, isCandidate: true },
        }));
        return [...cleaned, ...newEdges];
      });

      setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 200);
    } catch (e) {
      setNodeStatus(nodeId, "idle");
      showNotice(e instanceof Error ? e.message : "Error generating options");
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, isGenerating, userContext, setNodeStatus, setNodes, setEdges, fitView, showNotice]);

  const selectVersion = useCallback((selectedId: string) => {
    setNodes(nds => {
      const selected = nds.find(n => n.id === selectedId);
      if (!selected || !selected.data.parentId) return nds;
      const parentId = selected.data.parentId as string;

      return nds.map(n => {
        if (n.id === selectedId) {
          return { ...n, data: { ...n.data, isCandidate: false, isActive: true, isDiscarded: false } };
        }
        if (n.data.parentId === parentId && n.data.isCandidate && n.id !== selectedId) {
          return { ...n, data: { ...n.data, isDiscarded: true, isActive: false } };
        }
        return { ...n, data: { ...n.data, isActive: false } };
      });
    });

    setEdges(eds => eds.map(e => {
      if (e.target === selectedId) {
        return { ...e, animated: false, style: { stroke: "var(--foreground)", opacity: 0.4, strokeWidth: 2.5 }, data: { ...e.data, isCandidate: false } };
      }
      const targetNode = nodes.find(n => n.id === e.target);
      if (targetNode?.data.parentId === nodes.find(n => n.id === selectedId)?.data.parentId && e.target !== selectedId) {
        return { ...e, animated: false, style: { stroke: "var(--foreground)", opacity: 0.06, strokeWidth: 1 }, data: { ...e.data } };
      }
      return e;
    }));

    setActiveNodeId(selectedId);
    setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 100);
  }, [nodes, setNodes, setEdges, fitView]);

  const resetAll = useCallback(() => {
    setNodes([{
      id: "root",
      type: "glassNode",
      position: { x: 0, y: 0 },
      data: { text: "", isActive: true, status: "idle", isCandidate: false, stepNumber: 1 },
    }]);
    setEdges([]);
    setActiveNodeId("root");
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => fitView({ duration: 400, padding: 0.3 }), 100);
  }, [setNodes, setEdges, fitView]);

  const exportImage = async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    try {
      const url = await toPng(el, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#fff" });
      const link = document.createElement("a");
      link.download = "copychain.png";
      link.href = url;
      link.click();
      showNotice("Exported!");
    } catch { showNotice("Export failed"); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  const contextValue = {
    updateNodeText, reactivateNode, generateFromNode, selectVersion,
    activeNodeId, isGenerating,
  };

  return (
    <CanvasContext.Provider value={contextValue}>
      <div className="copy-canvas-container">
        {/* Brand */}
        <div className="brand">
          Copy Chain
          <span className="brand-tag">ALPHA</span>
        </div>

        {/* Corner actions */}
        <div className="corner-actions top-right">
          <div className="fab" onClick={() => {
            if (theme === "light") setTheme("warm");
            else if (theme === "warm") setTheme("dark");
            else setTheme("light");
          }} title="Toggle Theme">
            {theme === "light" && <Circle size={18} style={{ opacity: 0.5 }} />}
            {theme === "warm" && <Sun size={18} />}
            {theme === "dark" && <Moon size={18} fill="currentColor" />}
          </div>
          <div className="fab" onClick={resetAll} title="Reset Canvas"><RotateCcw size={18} /></div>
          <div className="fab" onClick={exportImage} title="Export PNG"><ImageDown size={18} /></div>
          <div className="fab" onClick={() => document.documentElement.requestFullscreen?.()} title="Fullscreen"><Expand size={18} /></div>
        </div>

        <div className="corner-actions bottom-left">
          <div className="fab" onClick={() => fitView({ duration: 800, padding: 0.2 })} title="Center View">
            <Maximize size={18} />
          </div>
        </div>

        {/* Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background gap={40} color="var(--line)" variant={BackgroundVariant.Lines} />
        </ReactFlow>

        {/* Text Bank */}
        <motion.div
          layout
          initial={false}
          animate={{
            width: contextOpen ? 340 : 130,
            height: contextOpen ? 280 : 44,
            borderRadius: contextOpen ? 24 : 22,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="text-bank-container"
        >
          <AnimatePresence mode="wait">
            {!contextOpen ? (
              <motion.div
                key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-bank-btn"
                onClick={() => setContextOpen(true)}
              >
                {userContext ? "* Text Bank" : "Text Bank"}
              </motion.div>
            ) : (
              <motion.div
                key="panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-bank-panel"
              >
                <div className="text-bank-header">
                  <span className="text-bank-title">Text Bank</span>
                  <div onClick={() => setContextOpen(false)} style={{ cursor: "pointer", opacity: 0.3, padding: 4 }}>
                    <Plus size={16} style={{ transform: "rotate(45deg)" }} />
                  </div>
                </div>
                <textarea
                  className="text-bank-input"
                  value={userContext}
                  onChange={(e) => setUserContext(e.target.value)}
                  placeholder="Brand voice, audience, banned words..."
                  autoFocus
                />
                <button className="text-bank-save" onClick={() => setContextOpen(false)}>
                  Save
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Notice toast */}
        <AnimatePresence>
          {notice && (
            <motion.div
              className="notice-toast"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CanvasContext.Provider>
  );
}
