"use client";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  BookOpen,
  Wrench,
  Calculator,
  Timer,
  ChevronRight,
  NotebookPen,
  MessageSquare,
  Send,
  GraduationCap,
  Brain,
  ListChecks,
} from "lucide-react";

// Accueil sans header - avec ligne de titre + statut + heure et chat dock

export default function HomePage() {
  const now = useNow();

  const todayTasks = [
    { label: "Relire le cours de Macro – chap. 4", done: false },
    { label: "Fiche rapide: définitions clés", done: false },
    { label: "Quiz 10 questions", done: false },
  ];
  const recentDocs = [
    { name: "Macro – Chapitre 4.pdf" },
    { name: "Finance – Ratios clefs.md" },
    { name: "Anglais – Vocab révisions.docx" },
    { name: "Stats – TD 2.xlsx" },
  ];
  const docFolders = ["Cours", "Fiches", "Exercices", "PDF", "Liens", "Ressources"];
  const examCerts = [
    { name: "AMF", desc: "QCM, fiches, annales" },
    { name: "CFA Niveau I", desc: "Curriculum, QBank, formules" },
    { name: "TOEIC", desc: "Tests blancs, vocabulaire" },
  ];
  const quickTools = [
    { name: "Flashcards", Icon: Brain },
    { name: "Quiz / QCM", Icon: ListChecks },
    { name: "Fiches rapides", Icon: NotebookPen },
    { name: "Minuteur", Icon: Timer },
  ];

  return (
    <main className="relative min-h-screen text-white overflow-hidden">
      {/* Background video */}
      <div className="absolute inset-0 -z-10">
        <video autoPlay muted loop playsInline preload="metadata" className="w-full h-full object-cover" poster="/bg/console.jpg">
          <source src="/bg/background.webm" type="video/webm" />
          <source src="/bg/background.mp4" type="video/mp4" />
        </video>
      </div>
      {/* Overlay for readability */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-[#0e1116]/75 to-[#111418]/88" />

      {/* Top line: Title + status/time (pas un header) */}
      <section className="max-w-7xl mx-auto px-6 pt-8 md:pt-10">
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <BrandTitle />
          <div className="flex items-center gap-3 text-xs text-gray-200">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> En ligne
            </span>
            <span suppressHydrationWarning className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono">{now}</span>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <section className="max-w-7xl mx-auto px-6 pb-16 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* MAIN: Aujourd'hui */}
          <Glass className="md:col-span-7 lg:col-span-8">
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#F0122D]/20 blur-3xl" />
            <SectionHeader title="Base documentaire" subtitle="Cours, fiches, PDFs, liens - tout au même endroit." Icon={BookOpen} />

            {/* dossiers favoris */}
            <div className="mt-5 flex flex-wrap gap-2">
              {docFolders.map((n) => (
                <button key={n} type="button" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#F0122D]">
                  {n}
                </button>
              ))}
            </div>

            {/* récents */}
            <h4 className="mt-6 text-sm font-medium text-white/80">Récents</h4>
            <ul className="mt-2 space-y-2">
              {recentDocs.slice(0,3).map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" aria-hidden />
                    <span className="truncate max-w-[20rem]">{d.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
                </li>
              ))}
            </ul>

            <div className="mt-7 flex items-center gap-3">
              <button type="button" className="rounded-xl bg-[#F0122D] px-5 py-2.5 text-sm font-medium shadow hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F0122D] focus:ring-offset-black">
                Ouvrir la base
              </button>
              <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#F0122D]">
                Importer
              </button>
            </div>

            <Screws />
          </Glass>

          {/* RIGHT COLUMN */}
          <div className="md:col-span-5 lg:col-span-4 grid grid-cols-1 gap-8">
            <Glass>
              <SectionHeader title="Révisions d'examen" subtitle="AMF, CFA, TOEIC... banques de QCM & fiches" Icon={GraduationCap} />
              <ul className="mt-5 space-y-2">
                {examCerts.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" aria-hidden />
                      <div className="truncate">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-300 truncate">{c.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
                  </li>
                ))}
              </ul>
            </Glass>

            <Glass>
              <SectionHeader title="Mes outils de révision" subtitle="Flashcards, QCM, fiches, minuterie" Icon={Brain} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {quickTools.map(({ name, Icon }) => (
                  <button key={name} type="button" className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#F0122D]">
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            </Glass>
          </div>
        </div>

        <p className="mt-10 text-xs text-gray-400">Astuce : Tab pour naviguer, Entrée pour activer - les liens sont inactifs pour le moment.</p>
      </section>

      {/* Chat dock */}
      <ChatDock />
    </main>
  );
}

/* --- Hooks --- */
function useNow() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* --- Components --- */
function BrandTitle() {
  return (
    <div className="relative group flex items-center gap-3">
      <span className="h-3 w-3 rounded-full bg-[#F0122D] shadow-[0_0_20px_#F0122D] animate-pulse" aria-hidden />
      <span className="text-[22px] md:text-[28px] font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-rose-200 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">
        StudyHub
      </span>
      <span aria-hidden className="absolute -bottom-1 left-6 h-[3px] w-24 rounded-full bg-gradient-to-r from-[#F0122D] to-transparent opacity-70 transition-all duration-300 group-hover:w-32" />
    </div>
  );
}

/* --- Components --- */
function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.002 }}
      whileTap={{ scale: 0.995 }}
      tabIndex={0}
      role="group"
      className={`relative rounded-2xl overflow-hidden border border-white/10 bg-black/35 backdrop-blur-md p-6 md:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_40px_rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-[#F0122D] ${className}`}
    >
      <div className="pointer-events-none absolute inset-3 rounded-xl bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:22px_22px]" />
      <div className="pointer-events-none absolute inset-3 rounded-xl opacity-5 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.4)_0,rgba(255,255,255,0.4)_1px,transparent_1px,transparent_3px)]" />
      <div className="relative z-10">{children}</div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, Icon }: { title: string; subtitle?: string; Icon: React.ElementType }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-white/10 p-3"><Icon className="h-6 w-6" aria-hidden /></div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold leading-tight tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-300">{subtitle}</p>}
      </div>
    </div>
  );
}

function TaskItem({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <CheckCircle2 className={`h-4 w-4 ${done ? "text-emerald-400" : "text-white/60"}`} aria-hidden />
      <span className="text-sm text-gray-200">{label}</span>
    </li>
  );
}

function Screws() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-5 top-5 h-2 w-2 rounded-full bg-white/30 shadow" />
      <div className="absolute right-5 top-5 h-2 w-2 rounded-full bg-white/30 shadow" />
      <div className="absolute left-5 bottom-5 h-2 w-2 rounded-full bg-white/30 shadow" />
      <div className="absolute right-5 bottom-5 h-2 w-2 rounded-full bg-white/30 shadow" />
    </div>
  );
}

function ChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: number; from: "moi" | "autre"; text: string }>>([
    { id: 1, from: "autre", text: "Hello ! Quelqu'un a compris l'exercice 3 ?" },
    { id: 2, from: "moi", text: "Je peux expliquer après 16h :)" },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function send() {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: Date.now(), from: "moi", text: t }]);
    setInput("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid place-items-center h-11 w-11 rounded-full border border-white/10 bg-black/40 backdrop-blur-md p-0 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-[#F0122D]"
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label="Chat étudiants"
        title="Chat étudiants"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {open && (
        <motion.div
          id="chat-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="mt-3 w-[320px] max-h-[50vh] rounded-xl border border-white/10 bg-black/70 backdrop-blur-md shadow-xl overflow-hidden"
          role="dialog"
          aria-label="Chat étudiants"
        >
          <div className="border-b border-white/10 p-3 text-sm flex items-center justify-between">
            <span className="font-medium">Chat étudiants</span>
            <span className="inline-flex items-center gap-2 text-xs text-gray-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> 5 en ligne
            </span>
          </div>
          <div ref={listRef} className="p-3 space-y-2 overflow-y-auto max-h-[34vh]">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "moi" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm border ${m.from === "moi" ? "bg-[#F0122D]/90 border-[#F0122D]" : "bg-white/10 border-white/10"}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-2 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Écrire un message..."
              className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F0122D]"
            />
            <button onClick={send} className="rounded-md border border-white/10 bg-white/10 px-3 py-2 hover:bg-white/15">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
