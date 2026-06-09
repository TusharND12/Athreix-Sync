"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
// @ts-ignore
import * as random from "maath/random/dist/maath-random.esm";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Share2,
  Globe,
  Shield,
  Zap,
  Cpu,
  Box,
  Network,
  ArrowRight,
  Fingerprint,
  WifiOff,
  EyeOff,
  Menu,
  X,
  ShieldCheck,
  Copy,
  Search,
  Infinity
} from "lucide-react";
import { cn } from "@/lib/utils";

function Starfield(props: any) {
  const ref = useRef<any>(null);
  const [sphere] = useState(() => random.inSphere(new Float32Array(5001), { radius: 1.5 }));

  useFrame((state, delta) => {
    ref.current.rotation.x -= delta / 10;
    ref.current.rotation.y -= delta / 15;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#ff5b1f"
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
}

function NeuralNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      pulse: number;
      pulseSpeed: number;
    }

    const nodes: Node[] = [];
    const nodeCount = 60;
    const connectionDistance = 180;

    const resize = () => {
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const initNodes = () => {
      nodes.length = 0;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 1,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.03,
        });
      }
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += node.pulseSpeed;

        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.15;
            const pulseGlow = (Math.sin(nodes[i].pulse) + 1) * 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(255, 91, 31, ${opacity + pulseGlow * 0.05})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const glow = (Math.sin(node.pulse) + 1) * 0.5;
        const r = node.radius + glow * 1.5;

        // Outer glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 4);
        gradient.addColorStop(0, `rgba(255, 91, 31, ${0.15 + glow * 0.1})`);
        gradient.addColorStop(1, "rgba(255, 91, 31, 0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 154, 74, ${0.5 + glow * 0.5})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    initNodes();
    draw();

    window.addEventListener("resize", () => {
      resize();
      initNodes();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.5 }}
    />
  );
}

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b-0 border-white/5 py-4 px-6 md:px-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff5b1f] to-[#ff9a4a] flex items-center justify-center">
            <Network className="w-4 h-4 text-white" />
          </div>
          <span className="display text-xl font-bold tracking-[0.18em]">ATHREIXSYNC</span>
        </div>





        <button
          className="md:hidden text-white/70 hover:text-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden pt-4 mt-4 border-t border-white/10 flex flex-col gap-4 overflow-hidden"
          >


          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
      <div className="absolute inset-0 z-0 opacity-40">
        <Canvas camera={{ position: [0, 0, 1] }}>
          <Starfield />
        </Canvas>
      </div>

      <div className="absolute inset-0 z-[1]">
        <NeuralNetwork />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ff5b1f]/20 via-[#0a0a0d]/80 to-[#0a0a0d] z-10 pointer-events-none" />

      <div className="relative z-20 text-center px-4 max-w-5xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--lava-300)] pulse-dot" />
          <span className="mono text-[10px] text-white/80 uppercase tracking-[0.2em]">ATHREIXSYNC BUILD BY ATHREIX.COM</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-6"
        >
          SHARE AT THE SPEED <br className="hidden md:block" />
          <span className="text-lava-gradient">
            OF THOUGHT.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mono text-xs md:text-sm text-white/60 max-w-2xl mb-10 leading-relaxed uppercase tracking-[0.2em]"
        >
          THE WORLD'S FIRST INTENT-DRIVEN, AI-NATIVE FILE SHARING ECOSYSTEM. NO LINKS. NO UPLOADS. NO FRICTION. JUST POINT, THINK, AND TRANSFER.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link href="/dashboard">
            <button className="btn-glow h-14 px-8 rounded-full bg-white text-black font-semibold text-lg flex items-center gap-2 group display tracking-widest">
              Open Web App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 opacity-50"
      >
        <span className="text-xs uppercase tracking-widest font-mono">Scroll to explore</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent" />
      </motion.div>
    </section>
  );
};

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.5, delay }}
    className="glass-card p-8 rounded-3xl relative overflow-hidden group hover:border-[#ff5b1f]/50 transition-colors"
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ff5b1f]/20 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#ff9a4a]/20 transition-colors duration-700" />
    <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-6 relative z-10 border border-white/10 group-hover:border-[#ff9a4a]/50 transition-colors">
      <Icon className="w-6 h-6 text-[var(--lava-300)]" />
    </div>
    <h3 className="text-xl font-semibold mb-3 text-white">{title}</h3>
    <p className="text-white/60 leading-relaxed font-light">{description}</p>
  </motion.div>
);

const Features = () => {
  const features = [
    {
      icon: Network,
      title: "Real-time WebRTC Mesh",
      description: "Connect devices instantly. Files transfer directly over P2P data channels, completely bypassing the cloud for maximum speed."
    },
    {
      icon: EyeOff,
      title: "Burn After Reading",
      description: "Send classified transmissions. Your sensitive files permanently vaporize from the receiver's device the moment they are closed."
    },
    {
      icon: ShieldCheck,
      title: "Zero-Knowledge Passkeys",
      description: "Secure your transfers. Require the receiver to enter an exact matching passkey before they can accept and download your files."
    },
    {
      icon: Copy,
      title: "Universal Clipboard",
      description: "Copy on your phone, paste on your desktop. Broadcast your clipboard text instantly to every device in your personal mesh."
    },
    {
      icon: Search,
      title: "Instant Peer Discovery",
      description: "No pairing, no QR codes. Devices on your network find each other automatically so you can start sharing in seconds."
    },
    {
      icon: Infinity,
      title: "Unlimited File Sizes",
      description: "No arbitrary cloud limits. Because files travel directly from device to device, you can transfer massive files with zero compression."
    }
  ];

  return (
    <section id="features" className="py-32 px-4 md:px-12 max-w-7xl mx-auto relative z-20">
      <div className="text-center mb-20">
        <h2 className="display text-3xl md:text-5xl tracking-[0.18em] mb-6">FILE SHARING, <span className="text-lava-gradient">REIMAGINED.</span></h2>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">We ripped out the friction of URLs, permissions, and uploads to build a system that moves at the speed of thought.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <FeatureCard key={i} {...f} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
};

const AIPromo = () => {
  return (
    <section className="py-32 px-4 relative z-20 border-y border-white/5 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--lava-300)]/30 bg-[var(--lava-300)]/10 text-[var(--lava-300)] text-sm font-medium">
            <Cpu className="w-4 h-4" />
            Core Intelligence
          </div>
          <h2 className="display text-4xl md:text-5xl leading-tight">
            AN ASSISTANT THAT <br />
            <span className="text-lava-gradient">NEVER FORGETS.</span>
          </h2>
          <p className="text-lg text-white/60 font-light leading-relaxed">
            AthreixSync indexes every file, conversation, and context. Just ask, "Show me the PDF I sent to Rahul before the marketing event," and it appears instantly.
          </p>
          <ul className="space-y-4">
            {["Semantic Search", "Auto-Categorization", "Duplicate Detection", "Content Summarization"].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-white/80">
                <div className="w-6 h-6 rounded-full bg-[var(--lava-300)]/20 flex items-center justify-center border border-[var(--lava-300)]/50">
                  <div className="w-2 h-2 rounded-full bg-[var(--lava-300)]" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 w-full max-w-md relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--lava-400)]/20 to-[var(--lava-300)]/20 blur-3xl -z-10 rounded-full group-hover:opacity-100 opacity-70 transition-opacity" />
          <a href="https://www.athreix.com/" target="_blank" rel="noreferrer" className="block transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff5b1f] to-[#ff9a4a]" />
              <div className="flex flex-col items-center justify-center space-y-6 py-4">
                <div className="glass px-8 py-3 rounded-2xl text-xl md:text-2xl text-white/90 border border-white/5 font-bold uppercase tracking-widest text-center inline-block">
                  BUILT BY
                </div>
                <div className="glass px-4 md:px-8 py-4 md:py-6 rounded-2xl border border-[var(--lava-300)]/30 bg-[var(--lava-300)]/5 flex items-center justify-center w-full shadow-[0_0_40px_-10px_rgba(255,91,31,0.2)]">
                  <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-[0.15em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#ff5b1f] to-[#ff9a4a] animate-pulse text-center whitespace-nowrap">
                    ATHREIX.COM
                  </span>
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};

const Security = () => (
  <section id="security" className="py-32 px-4 max-w-5xl mx-auto relative z-20 text-center">
    <Shield className="w-16 h-16 text-white/20 mx-auto mb-8" />
    <h2 className="display text-3xl md:text-5xl mb-6 tracking-[0.1em]">ZERO KNOWLEDGE. <br /><span className="text-[var(--lava-300)]/60">ABSOLUTE CONTROL.</span></h2>
    <p className="text-lg text-white/50 max-w-2xl mx-auto mb-12">
      Your files are encrypted on your device before they ever touch the network. Only you and your intended recipients hold the keys. Not even we can see what you share.
    </p>
    <div className="flex flex-wrap justify-center gap-4">
      <div className="glass px-6 py-3 rounded-full border border-white/10 text-sm font-medium text-white/80">End-to-End Encrypted</div>
      <div className="glass px-6 py-3 rounded-full border border-white/10 text-sm font-medium text-white/80">Passkey Authentication</div>
      <div className="glass px-6 py-3 rounded-full border border-white/10 text-sm font-medium text-white/80">Perfect Forward Secrecy</div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/5 pt-16 pb-8 px-6 md:px-12 relative z-20 bg-black">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#ff5b1f] to-[#ff9a4a] flex items-center justify-center">
            <Network className="w-3 h-3 text-white" />
          </div>
          <span className="display text-lg tracking-[0.18em]">ATHREIXSYNC</span>
        </div>
        <p className="text-white/50 text-sm max-w-xs">The intelligent, spatial, and secure file sharing network for the future.</p>
        <div className="mt-8 pt-6 border-t border-white/5 max-w-sm">
          <p className="text-white/40 text-xs leading-relaxed">
            Developed by <a href="https://www.athreix.com/" target="_blank" rel="noreferrer" className="text-[var(--lava-300)] font-medium hover:text-[var(--lava-100)] transition-colors">Athreix.com AI Automation Studio</a>.<br/>
            We build custom agents, AI SaaS platforms, internal tools, and production-grade ML for teams that move fast.
          </p>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs text-white/40">
      <p>© 2026 AthreixSync. All rights reserved.</p>
      <div className="flex gap-4 mt-4 md:mt-0">
        <a href="#" className="hover:text-white">Privacy Policy</a>
        <a href="#" className="hover:text-white">Terms of Service</a>
      </div>
    </div>
  </footer>
);

export default function Home() {
  return (
    <main className="bg-[#050505] min-h-screen text-foreground selection:bg-purple-500/30">
      <NavBar />
      <Hero />
      <Features />
      <AIPromo />
      <Security />
      <Footer />
    </main>
  );
}
