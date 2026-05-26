import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion as Motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// --- ICONS ---
import {
  User, Plus, Send, LogOut, FileText, Brain, MessageSquare,
  ChevronRight, ChevronLeft, Loader2, UploadCloud, Maximize2,
  Zap, Layout, Sparkles, CheckCircle2, Trash2, AlertTriangle,
  Lightbulb, Shield, Clock, Globe, Menu, X, ZoomIn, ZoomOut,
  Minimize2, Network, RefreshCw, PanelRightClose, PanelRightOpen,
  ArrowRight, Layers, MousePointer2, BookOpen, Quote, Star, GitGraph, Search, Lock, Mail
} from 'lucide-react';

// --- Configuration ---
const API_BASE_URL = "http://localhost:5000";
const pdfPreviewUrl = (id) => `${API_BASE_URL}/pdf/pdfs/${id}/file#toolbar=0&navpanes=0&scrollbar=0`;

// --- API Helper ---
const apiCall = async (endpoint, method = 'GET', body = null, isFormData = false) => {
  const options = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    credentials: 'include', // Crucial for session cookies
  };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(data?.error || data || 'API Request Failed');
  }
  return data;
};

// --- MARKMAP INTEGRATION ---
const loadScript = (src) => new Promise((resolve, reject) => {
  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    if (existingScript.getAttribute('data-loaded') === 'true') {
      resolve();
      return;
    }

    existingScript.addEventListener('load', resolve, { once: true });
    existingScript.addEventListener('error', reject, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => {
    script.setAttribute('data-loaded', 'true');
    resolve();
  };
  script.onerror = reject;
  document.head.appendChild(script);
});

const transformMarkmapData = (node) => {
  if (!node) return null;
  if (typeof node === 'string') return { content: node, children: [] };

  const newNode = {
    content: node.title || node.Title || node.label || node.Label || node.content || node.Content || "Node",
    children: [],
  };

  const children = node.children || node.Children;
  if (Array.isArray(children)) {
    newNode.children = children.map(transformMarkmapData).filter(Boolean);
  }

  const points = node.points || node.Points;
  if (Array.isArray(points)) {
    points.forEach(point => {
      newNode.children.push(transformMarkmapData(point));
    });
  }

  return newNode;
};

const MarkmapView = ({ data, onNodeClick }) => {
  const svgRef = useRef(null);
  const mmRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const initMarkmap = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/d3@7.8.2/dist/d3.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/markmap-view@0.14.0/dist/index.min.js');

        if (!window.d3 || !window.markmap?.Markmap) {
          throw new Error("Visualization libraries failed to load completely.");
        }

        if (isMounted) setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load markmap scripts", error);
        if (isMounted) setRenderError("Failed to load visualization engine.");
      }
    };

    initMarkmap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !svgRef.current || !data) return;

    try {
      const root = transformMarkmapData(data);
      if (!root) return;

      const { Markmap } = window.markmap;
      const colorScale = window.d3.scaleOrdinal(window.d3.schemeCategory10);

      if (!mmRef.current) {
        svgRef.current.innerHTML = "";
        mmRef.current = Markmap.create(svgRef.current, {
          autoFit: true,
          fitRatio: 0.95,
          color: (node) => colorScale(node.depth),
          duration: 500,
          padding: 50,
          spacingVertical: 5,
        }, root);
      } else {
        mmRef.current.setData(root);
        mmRef.current.fit();
      }
    } catch (error) {
      console.error("Markmap render error:", error);
      setRenderError(`Render Error: ${error.message}`);
    }
  }, [isLoaded, data]);

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return undefined;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        mmRef.current?.fit();
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isLoaded]);

  const handleSvgClick = (event) => {
    const node = event.target.closest('.markmap-node');
    const text = node?.textContent?.trim();
    if (text && onNodeClick) onNodeClick(text);
  };

  if (renderError) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-red-400 p-6 text-center">
        <AlertTriangle size={32} className="mb-2" />
        <p className="font-bold">Visualization Error</p>
        <p className="text-xs opacity-70">{renderError}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="animate-spin mr-2" /> Initializing Visualization...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-950 relative overflow-hidden font-sans flex items-center justify-center">
      <style>{`
        .markmap-node { cursor: pointer; }
        .markmap-node circle { stroke-width: 2px; transition: all 0.3s ease; }
        .markmap-node:hover circle { r: 8 !important; filter: drop-shadow(0 0 5px rgba(255,255,255,0.5)); }
        .markmap-node text { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; fill: #ffffff !important; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
        .markmap-foreign, .markmap-foreign div { color: #ffffff !important; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; }
        .markmap-link { stroke: #94a3b8; stroke-width: 2px; stroke-opacity: 0.8; }
        svg.markmap { width: 100%; height: 100%; display: block; }
      `}</style>
      <svg ref={svgRef} onClick={handleSvgClick} className="markmap" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

// --- Components ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", isDangerous = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <Motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100"
      >
        <div className="flex items-center gap-3 mb-4 text-slate-900">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDangerous ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-slate-500 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors text-sm">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white font-medium rounded-lg transition-colors text-sm shadow-lg shadow-blue-900/5 ${isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmText}</button>
        </div>
      </Motion.div>
    </div>
  );
};

// Combined Mind Map Viewer integrating the styling of the requested implementation
const MindMapViewer = ({ onCollapse, isExpanded, onToggleExpand, onClose, data, onNodeClick }) => {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 border-l border-slate-800">
      <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 font-black text-sm uppercase tracking-tighter text-slate-200">
          <Network size={18} className="text-purple-500" />
          MindMap
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <button
              onClick={onCollapse}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors"
              title="Collapse Panel"
            >
              <PanelRightClose size={18} />
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400 transition-colors"
            title={isExpanded ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"
            title="Close Mind Map"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 relative bg-slate-950 w-full overflow-hidden">
        {!data ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <p className="font-bold text-xs uppercase tracking-widest">Generating Knowledge Map...</p>
           </div>
        ) : (
          <MarkmapView data={data} onNodeClick={onNodeClick} />
        )}
      </div>
      <div className="h-10 border-t border-slate-800 bg-slate-900/50 flex items-center px-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        Click a node to ask the AI for more details
      </div>
    </div>
  );
};

// 1. Landing Page
const LandingPage = ({ onGetStarted, onLogin }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('home')}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30">
              <Brain size={18} />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">InSightPDF</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <button onClick={() => scrollToSection('home')} className="hover:text-blue-600 transition-colors">Home</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-blue-600 transition-colors">Features</button>
            <button onClick={() => scrollToSection('about')} className="hover:text-blue-600 transition-colors">About Us</button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={onGetStarted}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-full font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-600/20 hover:shadow-xl"
            >
              Get Started
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 p-2">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <Motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-4 flex flex-col gap-4 text-sm font-medium text-slate-600">
                <button onClick={() => scrollToSection('home')} className="text-left py-2 hover:text-blue-600">Home</button>
                <button onClick={() => scrollToSection('features')} className="text-left py-2 hover:text-blue-600">Features</button>
                <button onClick={() => scrollToSection('about')} className="text-left py-2 hover:text-blue-600">About Us</button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); onGetStarted(); }}
                  className="bg-blue-600 text-white py-3 rounded-xl font-bold text-center mt-2"
                >
                  Get Started
                </button>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <main id="home" className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 text-sm font-semibold mb-6 border border-blue-100"
          >
            <Zap size={14} className="fill-blue-600" />
            <span>AI-Powered Document Understanding</span>
          </Motion.div>
          <Motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]"
          >
            Understand your PDFs <br/>
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">with AI InSights.</span>
          </Motion.h1>
          <Motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            InSightPDF brings your PDFs to life. Summarize reports, extract key information, and have conversations with your documents using advanced AI.
          </Motion.p>
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onLogin}
              className="group h-14 px-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Try InSightPDF
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </Motion.div>
        </div>

        {/* Mock Interface Preview */}
        <Motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200 shadow-2xl shadow-blue-900/10 overflow-hidden bg-slate-50 aspect-video flex"
        >
          <div className="w-64 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col gap-4">
             <div className="h-8 w-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-md animate-pulse"></div>
             <div className="space-y-2 mt-4">
               {[1,2,3].map(i => <div key={i} className="h-10 w-full bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-lg"></div>)}
             </div>
          </div>
          <div className="flex-1 flex">
             <div className="flex-1 border-r border-slate-100 p-8 hidden sm:flex flex-col items-center justify-center bg-gradient-to-br from-blue-50/30 to-purple-50/30">
                <div className="w-32 h-40 bg-white shadow-lg rounded-lg mb-6 overflow-hidden border border-slate-200">
                  <div className="h-6 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                  <div className="p-4">
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-full"></div>
                      <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-xs text-slate-500">document.pdf</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-500 text-center">Upload your PDF to get started</p>
             </div>
             <div className="w-full sm:w-96 bg-white p-6 flex flex-col">
                <div className="flex-1 space-y-4">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg rounded-tl-none text-sm text-slate-600 w-3/4 border border-blue-100">
                    Hello! I've analyzed your document. I can summarize it, answer questions, or create a mind map for you.
                  </div>
                  <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg rounded-br-none text-sm text-white w-2/3 self-end ml-auto">
                    Summarize this document
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-medium text-slate-500 mb-1">Document Summary Preview:</div>
                    <div className="text-sm text-slate-700">
                      <div className="h-3 bg-slate-200 rounded w-full mb-1"></div>
                      <div className="h-3 bg-slate-200 rounded w-5/6 mb-1"></div>
                      <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-12 bg-slate-100 rounded-full px-4 flex items-center text-slate-400 text-sm">
                    Ask about your document...
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white">
                    <Send size={18} />
                  </div>
                </div>
             </div>
          </div>
        </Motion.div>
      </main>

      {/* Features & About Sections */}
      <section id="features" className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-16">Powerful Features</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {icon: Sparkles, title: "Instant Summaries", text: "Get concise, accurate summaries of lengthy reports, papers, and contracts in seconds.", color: "purple"},
              {icon: Lightbulb, title: "Mind Mapping", text: "Visualize complex information with automatically generated hierarchical mind maps.", color: "emerald"},
              {icon: MessageSquare, title: "Interactive Q&A", text: "Chat with your PDF as if you were talking to an expert who has memorized every page.", color: "blue"},
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className={`w-12 h-12 bg-${f.color}-50 text-${f.color}-600 rounded-xl flex items-center justify-center mb-6`}>
                  <f.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">About InSightPDF</h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-6">We are a team of researchers and engineers passionate about making knowledge accessible.</p>
            <div className="flex gap-6">
              {[ {icon: Shield, t: "Secure Data"}, {icon: Clock, t: "Real-time AI"}, {icon: Globe, t: "Global Access"} ].map((item,i) => (
                <div key={i} className="flex items-center gap-2 text-slate-700 font-medium">
                  <item.icon size={20} className="text-blue-600" /> <span>{item.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md aspect-square bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-1 shadow-2xl rotate-3 hover:rotate-0 transition-all duration-500">
              <div className="w-full h-full bg-white rounded-[20px] flex items-center justify-center flex-col gap-4 p-8 text-center">
                 <Brain size={64} className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 fill-blue-100" />
                 <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Our Mission</h3>
                 <p className="text-slate-500">To empower everyone to understand complex documents instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-50 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
          &copy; 2024 InSightPDF. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

// Typewriter Component
const TypewriterAuth = ({ texts }) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    let timeout;

    if (subIndex === texts[index].length + 1 && !reverse) {
      timeout = setTimeout(() => setReverse(true), 1500);
    } else if (subIndex === 0 && reverse) {
      timeout = setTimeout(() => {
        setReverse(false);
        setIndex((prev) => (prev + 1) % texts.length);
      }, 0);
    } else {
      timeout = setTimeout(() => {
        setSubIndex((prev) => prev + (reverse ? -1 : 1));
      }, reverse ? 30 : 60);
    }

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse, texts]);

  return (
    <div className="text-3xl md:text-5xl font-bold text-white min-h-[120px]">
      {texts[index].substring(0, subIndex)}
      <span className="text-blue-200 animate-pulse ml-1">|</span>
    </div>
  );
};

// 2. Auth Page
const AuthPage = ({ type = "login", onSwitch, onSuccess, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    setFormData({ name: "", email: "", password: "" });
    setShowPassword(false);
    setToast({ show: false, message: '' });
  }, [type]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const endpoint = type === 'login' ? '/auth/login' : '/auth/signup';
        const result = await apiCall(endpoint, 'POST', formData);

        setToast({ show: true, message: type === 'login' ? 'Login Successful!' : 'Account Created Successfully!' });

        setTimeout(() => {
          onSuccess(result);
        }, 1000);
    } catch (error) {
        setToast({ show: true, message: error.message || "Authentication failed" });
        // Hide error toast after 3 seconds
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden relative">
      <AnimatePresence mode="wait">
        <Motion.div
          key={type}
          initial={{ x: type === "login" ? "150%" : "-150%" }}
          animate={{ x: 0 }}
          exit={{ x: type === "login" ? "150%" : "-150%" }}
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          className={`absolute top-0 h-full ${type === "login" ? "right-0" : "left-0"} w-full md:w-[40%] bg-white shadow-2xl z-20 border-x border-slate-100 overflow-y-auto`}
        >
          <div className="min-h-full flex flex-col justify-center px-6 md:px-10 relative py-10">
            <AnimatePresence>
              {toast.show && (
                <Motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  className={`absolute top-10 left-0 right-0 mx-auto w-max z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-medium ${toast.message.includes('failed') || toast.message.includes('Error') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                >
                    {toast.message.includes('failed') ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}<span>{toast.message}</span>
                </Motion.div>
              )}
            </AnimatePresence>

            <div onClick={onBack} className="mb-8 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg"><Brain size={18} /></div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">InSightPDF</span>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-2">{type === "login" ? "Welcome Back" : "Create Account"}</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">{type === "login" ? "Enter your credentials to access your docs." : "Join InSightPDF and start chatting with documents."}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {type === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Full Name</label>
                  <input name="name" value={formData.name} onChange={handleChange} required placeholder="John Doe" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"/>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="name@company.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"/>
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                <input name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-12 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 transform -translate-y-1/2 pt-6 text-slate-400 hover:text-slate-600 transition-colors">{showPassword ? "Hide" : "Show"}</button>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3.5 rounded-xl font-bold transition-all mt-4 shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : type === "login" ? "Login" : "Create Account"}
              </button>
            </form>

            <p className="text-sm text-slate-500 text-center mt-6">{type === "login" ? "Don't have an account?" : "Already have an account?"} <button onClick={onSwitch} className="ml-2 text-blue-600 font-bold hover:text-blue-700">{type === "login" ? "Sign Up" : "Login"}</button></p>
          </div>
        </Motion.div>
      </AnimatePresence>

      <div className={`hidden md:flex absolute top-0 h-full w-[60%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 items-center justify-center text-center transition-all duration-700 ease-in-out z-10 ${type === "login" ? "left-0" : "left-[40%]"}`}>
        <div className="max-w-xl text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-10 border border-white/30 shadow-2xl"><Sparkles size={40} className="text-white animate-pulse" /></div>
          <TypewriterAuth texts={[
            "Welcome!",
            "Summarize PDFs in seconds.",
            "Create mind maps instantly.",
            "Ask questions directly to your documents.",
            "Generate structured insights instantly.",
            "Bring your research to life with AI."
          ]} />
          <p className="text-blue-100 mt-8 text-lg max-w-md mx-auto leading-relaxed font-light opacity-90">Experience the next generation of document interaction. Powered by advanced AI to save you hours of reading.</p>
        </div>
      </div>
    </div>
  );
};

// 4. Enhanced Document Viewer
const DocumentViewer = ({ fileUrl, onExpand, currentPage }) => {
  const [zoom, setZoom] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  const toggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if(onExpand) onExpand(newState);
  };

  // Enable Trackpad Zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.005;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 4));
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container && container.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <Motion.div
      className={`h-full flex flex-col relative overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50 bg-slate-100 p-4' : ''}`}
    >
      <div className={`flex flex-col h-full w-full bg-white ${isExpanded ? 'rounded-xl shadow-2xl overflow-hidden' : ''}`}>

        {/* Toolbar - Removed Original/Text Buttons */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
          <div className="flex items-center font-semibold text-slate-700">
            <FileText size={18} className="text-blue-600 mr-2" />
            Original PDF
          </div>
          <div className="flex items-center gap-2">
              <button onClick={toggleExpand} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600" title={isExpanded ? "Minimize" : "Fullscreen"}>
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18}/>}
              </button>
          </div>
        </div>

        {/* Content - No Padding on Container to remove gaps */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-50 relative flex justify-center">
          {fileUrl ? (
            <div
              style={{
                width: `${(isExpanded ? 90 : 100) * zoom}%`,
                minHeight: '100%',
                transition: 'width 0.1s ease-out'
              }}
              className="shadow-lg"
            >
              <iframe 
                key={`${fileUrl}-${currentPage}`}
                src={`${fileUrl.split('#')[0]}#page=${currentPage || 1}&toolbar=0&navpanes=0&scrollbar=0`} 
                className="w-full h-full border-none block" 
                title="PDF Preview" 
              />
            </div>
          ) : <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2">
                <FileText size={40} className="opacity-20" />
                <p>PDF Preview Unavailable</p>
                <p className="text-xs opacity-60">Upload a new file to preview content.</p>
              </div>}
        </div>
      </div>
    </Motion.div>
  );
};

// Markdown Renderer to format the chat reply text
const MarkdownRenderer = ({ content, onCitationClick }) => {
  if (!content) return null;

  const parseCitationsAndBold = (text) => {
    // 1. Split by bold first
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold inherit">{parseCitationsOnly(part.slice(2, -2))}</strong>;
      }
      return <React.Fragment key={i}>{parseCitationsOnly(part)}</React.Fragment>;
    });
  };

  const parseCitationsOnly = (text) => {
    const citationRegex = /(\[Page \d+\])/g;
    const segments = text.split(citationRegex);
    return segments.map((seg, idx) => {
      const match = seg.match(/\[Page (\d+)\]/);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        return (
          <button
            key={idx}
            onClick={() => onCitationClick && onCitationClick(pageNum)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors align-middle shadow-sm cursor-pointer"
            title={`Go to Page ${pageNum}`}
          >
            <FileText size={10} />
            p. {pageNum}
          </button>
        );
      }
      return seg;
    });
  };

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];
  lines.forEach((line, i) => {
    const trimmedLine = line.trim();
    const isListItem = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ');
    if (isListItem) {
      currentList.push(<li key={`li-${i}`} className="ml-4 list-disc pl-1 mb-1 inherit">{parseCitationsAndBold(trimmedLine.substring(2))}</li>);
    } else {
      if (currentList.length > 0) { elements.push(<ul key={`ul-${i}`} className="mb-3 space-y-1">{[...currentList]}</ul>); currentList = []; }
      if (trimmedLine.length > 0) elements.push(<p key={`p-${i}`} className="mb-2 last:mb-0 leading-relaxed inherit">{parseCitationsAndBold(line)}</p>);
      else elements.push(<div key={`br-${i}`} className="h-2" />);
    }
  });
  if (currentList.length > 0) elements.push(<ul key={`ul-end`} className="mb-3 space-y-1">{[...currentList]}</ul>);
  return <div className="text-sm">{elements}</div>;
};

// 5. Chat Interface (Fixed Scroll Logic)
const ChatInterface = ({ messages, onSend, isTyping, onShowMindMap, showHeader = true, initialScrollPosition, saveScrollPosition, onCitationClick }) => {
  const [input, setInput] = useState('');
  const localScrollRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevMessagesLength = useRef(messages.length);

  // Restore scroll position ONCE on mount
  useEffect(() => {
    if (scrollContainerRef.current && initialScrollPosition !== undefined) {
      scrollContainerRef.current.scrollTop = initialScrollPosition;
    }
  }, [initialScrollPosition]);

  // Save scroll position on unmount
  useEffect(() => {
    const container = scrollContainerRef.current;
    return () => {
      if (container && saveScrollPosition) {
        saveScrollPosition(container.scrollTop);
      }
    };
  }, [saveScrollPosition]);

  // Auto-scroll ONLY on new messages
  useLayoutEffect(() => {
    if (messages.length > prevMessagesLength.current) {
        localScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        prevMessagesLength.current = messages.length;
    }
  }, [messages, isTyping]);

  const submitMessage = () => {
    const text = input.trim();
    if (!text || isTyping) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {showHeader && (
        <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
           <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" />
              <span className="font-semibold text-slate-700">Chat Assistant</span>
           </div>
           {onShowMindMap && (
             <button onClick={onShowMindMap} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-full text-xs font-semibold transition-colors border border-purple-100">
               <Network size={14} />
               <span>Mind Map</span>
             </button>
           )}
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
             <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600"><MessageSquare size={32} /></div>
             <h3 className="text-lg font-bold text-slate-800">Ask questions about your PDF</h3>
             <p className="text-slate-500 text-sm max-w-xs mt-2">DocMind has analyzed the content.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'}`}>
              {/* Used the imported MarkdownRenderer to match the requested text style */}
              <MarkdownRenderer content={msg.text} onCitationClick={onCitationClick} />
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none border border-slate-200 flex gap-2 items-center">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={localScrollRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitMessage()}
            placeholder="Ask a question..."
            className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 transition-all shadow-sm"
          />
          <button onClick={submitMessage} disabled={!input.trim() || isTyping} className="absolute right-2 p-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Container ---

export default function App() {
  const [view, setView] = useState('landing');
  const [authType, setAuthType] = useState('login');
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Dashboard State
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [messages, setMessages] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiTyping, setAiTyping] = useState(false);
  const [mindMapData, setMindMapData] = useState({}); // Stores mind map data per document
  const [currentPage, setCurrentPage] = useState(1); // Track current PDF page for citations

  // Ref for persisting scroll position across re-renders
  const chatScrollRef = useRef(0);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [layoutMode, setLayoutMode] = useState('standard');
  const [leftPanelContent, setLeftPanelContent] = useState('chat');
  const [isPdfExpanded, setIsPdfExpanded] = useState(false);
  const [isMindMapExpanded, setIsMindMapExpanded] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Modal States
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Auth Check on Mount
  useEffect(() => {
    const checkSession = async () => {
        try {
            const res = await apiCall('/auth/me');
            setUser(res);
            setView('dashboard');
            fetchDocuments();
        } catch {
            // Not logged in, stay on landing
        }
    };
    checkSession();
  }, []);

  // Fetch Documents
  const fetchDocuments = async () => {
      try {
          const docs = await apiCall('/pdf/pdfs');
          // Map backend format to frontend format
          const formattedFiles = docs.map(d => ({
              id: d.id,
              name: d.filename,
              status: d.status,
              timestamp: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recently',
              previewUrl: pdfPreviewUrl(d.id)
          }));
          setFiles(formattedFiles);
      } catch (e) {
          console.error("Failed to fetch docs", e);
      }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch chat history when active file changes
  useEffect(() => {
    if (!activeFileId) return;
    setCurrentPage(1); // Reset page selection on document change

    const fetchChatHistory = async () => {
      try {
        const history = await apiCall(`/chat/history/${activeFileId}`);
        if (history && history.length > 0) {
          setMessages(prev => ({
            ...prev,
            [activeFileId]: history
          }));
        } else {
          setMessages(prev => {
            if (prev[activeFileId] && prev[activeFileId].length > 0) {
              return prev;
            }
            const fileObj = files.find(f => f.id === activeFileId);
            const fileName = fileObj ? fileObj.name : "document";
            return {
              ...prev,
              [activeFileId]: [{ role: 'assistant', text: `I've analyzed **${fileName}**. Ready to chat! What would you like to know?` }]
            };
          });
        }
      } catch (e) {
        console.error("Failed to fetch chat history", e);
      }
    };

    fetchChatHistory();
  }, [activeFileId, files]);


  const handleAuth = (userData) => {
      setUser(userData);
      setView('dashboard');
      fetchDocuments();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10); // Start

    try {
        // 1. Upload
        const formData = new FormData();
        formData.append('pdf', file);
        const uploadRes = await apiCall('/pdf/upload-pdf', 'POST', formData, true);
        const docId = uploadRes.document_id;

        setUploadProgress(40);

        // 2. Process
        const processRes = await apiCall('/pdf/process-pdf', 'POST', { document_id: docId });
        setUploadProgress(100);

        const newFile = {
            id: docId,
            name: file.name,
            previewUrl: pdfPreviewUrl(docId),
            timestamp: new Date().toLocaleDateString(),
            status: processRes.status || 'ready'
        };
        setFiles(prev => [newFile, ...prev]);
        setActiveFileId(docId);
        setMessages(prev => ({
            ...prev,
            [docId]: [{ role: 'assistant', text: `I've analyzed **${file.name}**. Ready to chat! What would you like to know?` }]
        }));

    } catch (error) {
        console.error(error);
        alert("Upload failed: " + error.message);
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
        e.target.value = '';
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || !activeFileId) return;

    // Optimistic Update
    setMessages(prev => ({ ...prev, [activeFileId]: [...(prev[activeFileId] || []), { role: 'user', text }] }));
    setAiTyping(true);

    try {
        const res = await apiCall('/chat/chat', 'POST', {
            document_id: activeFileId,
            query: text
        });

        setMessages(prev => ({ ...prev, [activeFileId]: [...(prev[activeFileId] || []), { role: 'assistant', text: res.answer }] }));
    } catch (error) {
        setMessages(prev => ({ ...prev, [activeFileId]: [...(prev[activeFileId] || []), { role: 'assistant', text: `Sorry, I encountered an error answering that. ${error.message}` }] }));
    } finally {
        setAiTyping(false);
    }
  };

  const handleCitationClick = (pageNum) => {
    setCurrentPage(pageNum);
    if (layoutMode === 'mindmap' && leftPanelContent === 'chat') {
      setLeftPanelContent('pdf');
    }
  };

  const handleMindMapNodeClick = (text) => {
    if (layoutMode === 'mindmap' && leftPanelContent === 'pdf') {
        setLeftPanelContent('chat');
    }
    handleSendMessage(`Explain this concept from the document: ${text}`);
  };
  const handleNewChat = () => {
    setActiveFileId(null);
    if (isMobile) setIsSidebarOpen(false);
    setLayoutMode('standard');
    setIsPdfExpanded(false);
  };

  const handleDeleteClick = (e, fileId) => { e.stopPropagation(); setFileToDelete(fileId); };

  const confirmDelete = async () => {
    if (fileToDelete) {
      try {
          await apiCall(`/pdf/pdfs/${fileToDelete}`, 'DELETE');
          setFiles(prev => prev.filter(f => f.id !== fileToDelete));
          if (activeFileId === fileToDelete) { setActiveFileId(null); setLayoutMode('standard'); setIsPdfExpanded(false); }
          const newMessages = { ...messages };
          delete newMessages[fileToDelete];
          setMessages(newMessages);
      } catch (error) {
          alert("Failed to delete: " + error.message);
      }
    }
    setFileToDelete(null);
  };

  const handleLogoutClick = () => setShowLogoutConfirm(true);

  const confirmLogout = async () => {
    try {
        await apiCall('/auth/logout', 'POST');
        setShowLogoutConfirm(false);
        setView('landing');
        setUser(null);
    } catch (e) {
        console.error(e);
    }
  };

  const toggleMindMap = async () => {
    if (layoutMode === 'standard') {
      setLayoutMode('mindmap');
      setLeftPanelContent('chat');
      setRightPanelCollapsed(false);

      // Fetch Mind Map if not exists
      if (!mindMapData[activeFileId]) {
          try {
              const res = await apiCall('/pdf/mindmap', 'POST', { document_id: activeFileId });
              setMindMapData(prev => ({ ...prev, [activeFileId]: res.mindmap }));
          } catch (error) {
              console.error(error);
              setMindMapData(prev => ({ ...prev, [activeFileId]: "Error generating mind map." }));
          }
      }

    } else {
      // Closing Mind Map returns to Default
      setLayoutMode('standard');
      setRightPanelCollapsed(false);
    }
  };

  const toggleLeftPanelContent = () => { setLeftPanelContent(prev => prev === 'chat' ? 'pdf' : 'chat'); };

  const handlePdfExpand = (isExpanded) => {
    setIsPdfExpanded(isExpanded);
    if (isExpanded) { setIsSidebarOpen(false); }
  };

  const toggleMindMapExpand = () => {
    setIsMindMapExpanded(!isMindMapExpanded);
    if (!isMindMapExpanded) { setIsSidebarOpen(false); }
  };

  if (view === 'landing') return <LandingPage onGetStarted={() => { setAuthType('signup'); setView('auth'); }} onLogin={() => { setAuthType('login'); setView('auth'); }} />;
  if (view === "auth") return <AuthPage type={authType} onSwitch={() => setAuthType(authType === "login" ? "signup" : "login")} onSuccess={handleAuth} onBack={() => setView("landing")} />;

  const activeFile = files.find(f => f.id === activeFileId);
  const activeMessages = activeFileId ? (messages[activeFileId] || []) : [];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-20 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col z-30 shadow-xl shadow-blue-900/5 transition-all duration-300 ease-in-out ${isMobile ? `fixed h-full top-0 left-0 ${isSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full w-[280px]'}` : (isSidebarOpen ? 'w-[280px]' : 'w-[80px]')}`}>
        <div className={`flex items-center h-20 shrink-0 border-b border-slate-100 transition-all cursor-pointer hover:bg-slate-50 ${isSidebarOpen ? 'px-6 justify-between' : 'justify-center'}`} onClick={() => !isMobile && setIsSidebarOpen(!isSidebarOpen)}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/20 shrink-0"><Brain size={18} /></div>
                {(isSidebarOpen || isMobile) && <Motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">InSightPDF</Motion.span>}
            </div>
            {isMobile && <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(false); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>}
        </div>

        <div className="p-4">
          <button onClick={handleNewChat} className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 cursor-pointer group active:scale-[0.98] ${isSidebarOpen || isMobile ? 'w-full py-3 px-4 rounded-xl' : 'w-12 h-12 rounded-full'}`} title={!isSidebarOpen && !isMobile ? "New Chat" : ""}>
            <Plus size={20} className={(!isMobile && !isSidebarOpen) ? "" : "group-hover:rotate-90 transition-transform duration-300"} />
            {(isSidebarOpen || isMobile) && <span>New Chat</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          {files.map(file => (
              <button key={file.id} onClick={() => { setActiveFileId(file.id); if(isMobile) setIsSidebarOpen(false); setLayoutMode('standard'); setIsPdfExpanded(false); }} className={`w-full group flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${activeFileId === file.id ? 'bg-blue-50 border-blue-100 text-blue-700 shadow-sm' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'} ${(!isSidebarOpen && !isMobile) ? 'justify-center' : ''}`} title={(!isSidebarOpen && !isMobile) ? file.name : ""}>
                <FileText size={18} className={activeFileId === file.id ? 'text-blue-600' : 'text-slate-400'} />
                {(isSidebarOpen || isMobile) && <div className="flex-1 overflow-hidden"><div className="truncate font-medium text-sm">{file.name}</div><div className="text-[10px] opacity-70">{file.timestamp}</div></div>}
                {(isSidebarOpen || isMobile) && <div className="flex items-center gap-2"><div onClick={(e) => handleDeleteClick(e, file.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></div>{activeFileId === file.id && <ChevronRight size={14} />}</div>}
              </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-100 ${(!isSidebarOpen && !isMobile) ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm"><User size={16} /></div>
            {(isSidebarOpen || isMobile) && <div className="flex-1 overflow-hidden"><div className="font-semibold text-sm text-slate-800 truncate">{user?.name}</div><div className="text-xs text-slate-500 truncate">Free Plan</div></div>}
            {(isSidebarOpen || isMobile) && <LogOut size={16} className="text-slate-400 hover:text-red-500 transition-colors" onClick={handleLogoutClick} />}
          </div>
          {(!isSidebarOpen && !isMobile) && <div className="mt-2 flex justify-center"><button onClick={handleLogoutClick} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={18} /></button></div>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50">
        {!activeFileId && !isUploading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10 p-8"><div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-blue-900/5 mb-6 animate-in zoom-in duration-500"><UploadCloud size={40} className="text-blue-600" /></div><h2 className="text-3xl font-bold text-slate-800 mb-3 text-center">Upload a Document</h2><p className="text-slate-500 text-center max-w-md mb-8 px-4">Drag and drop your PDF here, or click the button below to start chatting with your data.</p><label className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-3"><Plus size={20} />Select PDF<input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} /></label></div>}

        {isUploading && <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center px-6"><div className="w-full max-w-sm"><div className="flex justify-between text-sm font-bold text-slate-700 mb-2"><span>Uploading...</span><span>{uploadProgress}%</span></div><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><Motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} className="h-full bg-blue-600 rounded-full" /></div></div></div>}

        {activeFileId && (
          <div className="flex-1 flex overflow-hidden relative">
            <LayoutGroup>
              {/* LEFT PANEL */}
              <Motion.div
                layout
                className={`flex flex-col border-r border-slate-200 transition-all duration-300 ${
                  isPdfExpanded ? 'fixed inset-0 z-40 bg-white w-full h-full' :
                  (isMobile ? (layoutMode === 'standard' ? 'hidden' : 'w-full') :
                  (layoutMode === 'mindmap' && rightPanelCollapsed ? 'w-[calc(100%-48px)]' : 'w-1/2'))
                }`}
              >
                 {layoutMode === 'mindmap' && !isMobile && !isPdfExpanded && (
                   <div className="h-14 border-b border-slate-200 bg-white flex items-center px-4 justify-between shrink-0">
                     <span className="font-semibold text-slate-700 flex items-center gap-2">
                       {leftPanelContent === 'chat' ? <MessageSquare size={18} className="text-blue-600"/> : <FileText size={18} className="text-blue-600"/>}
                       {leftPanelContent === 'chat' ? 'Chat Assistant' : 'Document Viewer'}
                     </span>
                     <button onClick={toggleLeftPanelContent} className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center gap-2"><RefreshCw size={12} />Switch to {leftPanelContent === 'chat' ? 'PDF' : 'Chat'}</button>
                   </div>
                 )}

                 <div className="flex-1 min-h-0 flex flex-col">
                   {(layoutMode === 'standard' || leftPanelContent === 'pdf') ? (
                       <DocumentViewer fileUrl={activeFile?.previewUrl} onExpand={handlePdfExpand} currentPage={currentPage} />
                   ) : (
                       <ChatInterface
                         messages={activeMessages}
                         onSend={handleSendMessage}
                         isTyping={aiTyping}
                         onShowMindMap={null}
                         showHeader={false}
                         initialScrollPosition={chatScrollRef.current}
                         saveScrollPosition={(pos) => chatScrollRef.current = pos}
                         onCitationClick={handleCitationClick}
                        />
                   )}
                 </div>
              </Motion.div>

              {/* RIGHT PANEL */}
              {!isPdfExpanded && (
                layoutMode === 'standard' ? (
                  <Motion.div layout className={`flex flex-col bg-white ${isMobile ? 'w-full' : 'flex-1'}`}>
                    <ChatInterface
                      messages={activeMessages}
                      onSend={handleSendMessage}
                      isTyping={aiTyping}
                      onShowMindMap={toggleMindMap}
                      showHeader={true}
                      initialScrollPosition={chatScrollRef.current}
                      saveScrollPosition={(pos) => chatScrollRef.current = pos}
                      onCitationClick={handleCitationClick}
                    />
                  </Motion.div>
                ) : (
                  <Motion.div
                    layout
                    className={`${rightPanelCollapsed ? 'w-12 bg-slate-50 border-l border-slate-200 flex flex-col items-center py-4' : 'flex-1 flex flex-col bg-white'} ${isMindMapExpanded ? 'fixed inset-0 z-50' : ''} transition-all duration-300`}
                  >
                    {rightPanelCollapsed ? (
                      <button onClick={() => setRightPanelCollapsed(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Expand Panel"><PanelRightOpen size={20}/></button>
                    ) : (
                      <MindMapViewer
                        onCollapse={() => setRightPanelCollapsed(true)}
                        isExpanded={isMindMapExpanded}
                        onToggleExpand={toggleMindMapExpand}
                        onClose={toggleMindMap}
                        data={mindMapData[activeFileId]}
                        onNodeClick={handleMindMapNodeClick}
                      />
                    )}
                  </Motion.div>
                )
              )}
            </LayoutGroup>
          </div>
        )}
      </main>

      <AnimatePresence>
        {fileToDelete && <ConfirmationModal isOpen={true} title="Delete Chat?" message="Are you sure you want to delete this chat?" onConfirm={confirmDelete} onCancel={() => setFileToDelete(null)} confirmText="Delete" isDangerous={true} />}
        {showLogoutConfirm && <ConfirmationModal isOpen={true} title="Log Out?" message="Are you sure you want to log out?" onConfirm={confirmLogout} onCancel={() => setShowLogoutConfirm(false)} confirmText="Log Out" isDangerous={true} />}
      </AnimatePresence>
    </div>
  );
}
