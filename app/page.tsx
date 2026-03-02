'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDhHHzBrFUWyudcVDfwKliG5gM10WmDIFM",
  authDomain: "vapor-todo-list.firebaseapp.com",
  projectId: "vapor-todo-list",
  storageBucket: "vapor-todo-list.firebasestorage.app",
  messagingSenderId: "996487428121",
  appId: "1:996487428121:web:ebab0c6fb09ec11d815288",
  measurementId: "G-070HRFEVFD"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

interface Task { id: string; text: string; completed: boolean; completedAt?: string; }
interface Project { id: string; name: string; tasks: Task[]; bgColor?: string; isCompleted?: boolean; }
type Accent = 'gray' | 'indigo' | 'violet' | 'fuchsia' | 'rose' | 'amber' | 'emerald' | 'teal' | 'cyan' | 'lime';

const ACCENT_CLASS_MAP: Record<Accent, { bg: string; dot: string; bar: string }> = {
  gray: { bg: 'bg-zinc-600', dot: 'bg-zinc-600', bar: 'bg-zinc-600' },
  indigo: { bg: 'bg-indigo-600', dot: 'bg-indigo-600', bar: 'bg-indigo-600' },
  violet: { bg: 'bg-violet-600', dot: 'bg-violet-600', bar: 'bg-violet-600' },
  fuchsia: { bg: 'bg-fuchsia-600', dot: 'bg-fuchsia-600', bar: 'bg-fuchsia-600' },
  rose: { bg: 'bg-rose-600', dot: 'bg-rose-600', bar: 'bg-rose-600' },
  amber: { bg: 'bg-amber-600', dot: 'bg-amber-600', bar: 'bg-amber-600' },
  emerald: { bg: 'bg-emerald-600', dot: 'bg-emerald-600', bar: 'bg-emerald-600' },
  teal: { bg: 'bg-teal-600', dot: 'bg-teal-600', bar: 'bg-teal-600' },
  cyan: { bg: 'bg-cyan-600', dot: 'bg-cyan-600', bar: 'bg-cyan-600' },
  lime: { bg: 'bg-lime-600', dot: 'bg-lime-600', bar: 'bg-lime-600' }
};

const getContrastColor = (hex?: string) => {
  if (!hex) return 'text-zinc-900 dark:text-zinc-100';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? 'text-zinc-900' : 'text-white';
};

export default function ProductivityApp() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [accent, setAccent] = useState<Accent>('indigo');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        const unsubData = onSnapshot(doc(db, "users", user.uid), (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setProjects(data.projects || []);
            // LOAD ACCENT FROM CLOUD
            if (data.accent) setAccent(data.accent);
          }
        });
        return () => unsubData();
      } else {
        signInAnonymously(auth);
      }
    });
    return () => unsubAuth();
  }, []);

  // Updated save function to handle both projects and settings
  const saveToCloud = async (updatedProjects: Project[], updatedAccent?: Accent) => {
    if (!userId) return;
    const cleanProjects = JSON.parse(JSON.stringify(updatedProjects));
    await setDoc(doc(db, "users", userId), { 
      projects: cleanProjects,
      accent: updatedAccent || accent 
    }, { merge: true });
  };

  const updateAccent = (newAccent: Accent) => {
    setAccent(newAccent);
    saveToCloud(projects, newAccent);
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (err) { console.error(err); }
  };

  const handleLogout = () => signOut(auth);

  const addProject = () => {
    if (!newProjectName.trim()) return;
    const newList = [...projects, { id: crypto.randomUUID(), name: newProjectName.trim(), tasks: [], bgColor: '', isCompleted: false }];
    saveToCloud(newList);
    setNewProjectName('');
  };

  const deleteProject = (projectId: string) => {
    if (!confirm("Delete this list?")) return;
    saveToCloud(projects.filter(p => p.id !== projectId));
  };

  const toggleProjectComplete = (projectId: string) => {
    const newList = projects.map(p => p.id === projectId ? { ...p, isCompleted: !p.isCompleted } : p);
    saveToCloud(newList);
  };

  const updateProjectColor = (projectId: string, color: string) => {
    const newList = projects.map(p => p.id === projectId ? { ...p, bgColor: color } : p);
    saveToCloud(newList);
  };

  const addTask = (projectId: string, text: string) => {
    if (!text.trim()) return;
    const newList = projects.map(p => p.id === projectId ? {
      ...p, tasks: [...p.tasks, { id: crypto.randomUUID(), text: text.trim(), completed: false }]
    } : p);
    saveToCloud(newList);
  };

  const toggleTask = (projectId: string, taskId: string) => {
    const newList = projects.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => {
          if (t.id !== taskId) return t;
          const isCompleting = !t.completed;
          const updatedTask = { ...t, completed: isCompleting };
          if (isCompleting) {
            updatedTask.completedAt = new Date().toLocaleDateString();
          } else {
            delete updatedTask.completedAt;
          }
          return updatedTask;
        })
      };
    });
    saveToCloud(newList);
  };

  const visibleProjects = projects.filter(p => {
    if (activeTab === 'active') return !p.isCompleted;
    return p.isCompleted || p.tasks.some(t => t.completed);
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`}>
      <div className={`${ACCENT_CLASS_MAP[accent].bg} text-white`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight">Vapor Lists</h1>
            {userEmail ? (
              <button onClick={handleLogout} className="group flex items-center gap-2 text-[10px] bg-white/10 px-3 py-1.5 rounded-md border border-white/10">
                <span className="opacity-70 group-hover:hidden uppercase tracking-widest">{userEmail}</span>
                <span className="hidden group-hover:inline uppercase tracking-widest font-bold text-rose-300">Sign Out</span>
              </button>
            ) : (
              <button onClick={handleGoogleLogin} className="flex items-center gap-2 bg-white text-zinc-700 px-3 py-1.5 rounded-md text-[12px] font-bold">Sign in</button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDark(!isDark)} className="text-xl">{isDark ? '☀️' : '🌙'}</button>
            <div className="flex gap-1.5">
              {(Object.keys(ACCENT_CLASS_MAP) as Accent[]).map(color => (
                <button 
                  key={color} 
                  onClick={() => updateAccent(color)} 
                  className={`w-4 h-4 rounded-full border ${accent === color ? 'border-white scale-110' : 'border-transparent opacity-60'} ${ACCENT_CLASS_MAP[color].dot}`} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 text-xs font-semibold rounded-md ${activeTab === 'active' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Active</button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-1.5 text-xs font-semibold rounded-md ${activeTab === 'completed' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Archive</button>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <button onClick={() => setIsCompact(!isCompact)}>{isCompact ? 'Comfortable' : 'Compact'}</button>
            <button onClick={() => setCollapsed(Object.fromEntries(projects.map(p => [p.id, true])))}>Collapse All</button>
            <button onClick={() => setCollapsed({})}>Show All</button>
          </div>
        </div>

        <div className="flex gap-3 max-w-2xl mb-10">
          <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="New list name..." className="flex-1 px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
          <button onClick={addProject} className={`px-6 py-2 rounded-lg text-sm font-bold text-white ${ACCENT_CLASS_MAP[accent].bg}`}>Add List</button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {visibleProjects.map((project) => {
              const isCollapsed = collapsed[project.id];
              const tasks = project.tasks.filter(t => (activeTab === 'active' ? !t.completed : t.completed));
              const progress = project.tasks.length ? (project.tasks.filter(t => t.completed).length / project.tasks.length) * 100 : 0;
              const contrastClass = getContrastColor(project.bgColor);

              if (activeTab === 'completed' && tasks.length === 0 && !project.isCompleted) return null;

              return (
                <div key={project.id} style={{ backgroundColor: project.bgColor || undefined }} className={`group border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all shadow-sm ${!project.bgColor ? 'bg-white dark:bg-zinc-900' : ''} ${isCompact ? 'p-3' : 'p-5'}`}>
                  <div className="flex justify-between items-center text-sm font-bold mb-2">
                    <span onClick={() => setCollapsed(prev => ({...prev, [project.id]: !isCollapsed}))} className={`cursor-pointer uppercase tracking-tight truncate ${contrastClass}`}>{project.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative h-6 w-6">
                        <span className="absolute inset-0 flex items-center justify-center text-xs">🎨</span>
                        <input type="color" onChange={(e) => updateProjectColor(project.id, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                      <button onClick={() => toggleProjectComplete(project.id)} className={`p-1.5 rounded hover:bg-black/5 ${contrastClass}`}>{project.isCompleted ? '↩️' : '✅'}</button>
                      <button onClick={() => deleteProject(project.id)} className="p-1.5 text-rose-400">🗑️</button>
                    </div>
                  </div>
                  <div className="w-full h-[2px] bg-black/10 dark:bg-white/10 mb-4 rounded-full overflow-hidden">
                      <div className={`h-full ${ACCENT_CLASS_MAP[accent].bg}`} style={{ width: `${progress}%` }} />
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-1.5">
                      {tasks.map((task) => (
                        <div key={task.id} className={`flex items-center justify-between rounded-lg group/task ${project.bgColor ? 'bg-black/10' : 'bg-zinc-50 dark:bg-zinc-800'} ${isCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
                          <div className="flex flex-col pr-2 overflow-hidden">
                              <span className={`text-[12px] leading-tight ${task.completed ? 'line-through opacity-40' : contrastClass}`}>{task.text}</span>
                              {task.completedAt && <span className={`text-[8px] font-bold opacity-30 mt-0.5 ${contrastClass}`}>Finished: {task.completedAt}</span>}
                          </div>
                          <button onClick={() => toggleTask(project.id, task.id)} className="text-[9px] font-bold text-emerald-500 opacity-0 group-hover/task:opacity-100 transition-opacity whitespace-nowrap">
                            {task.completed ? 'UNDO' : 'DONE'}
                          </button>
                        </div>
                      ))}
                      {activeTab === 'active' && <input placeholder="Add item..." className={`w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 py-1.5 text-[11px] ${contrastClass} placeholder:opacity-40`} onKeyDown={e => { if (e.key === 'Enter') { addTask(project.id, e.currentTarget.value); e.currentTarget.value = ''; } }} />}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}