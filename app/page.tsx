'use client';

import { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
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

// --- Types ---
interface Task { id: string; text: string; completed: boolean; completedAt?: string; }
interface Project { id: string; name: string; tasks: Task[]; bgColor?: string; }
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [accent, setAccent] = useState<Accent>('indigo');
  
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [draggedProjectIndex, setDraggedProjectIndex] = useState<number | null>(null);
  const [draggedTask, setDraggedTask] = useState<{tid: string, pid: string} | null>(null);

  // --- FIREBASE SYNC LOGIC ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        const unsubData = onSnapshot(doc(db, "users", user.uid), (doc) => {
          if (doc.exists()) setProjects(doc.data().projects || []);
          else setProjects([]); // Clear UI if no cloud data exists for this user
        });
        return () => unsubData();
      } else {
        signInAnonymously(auth);
      }
    });
    return () => unsubAuth();
  }, []);

  const saveToCloud = async (updatedProjects: Project[]) => {
    if (!userId) return;
    await setDoc(doc(db, "users", userId), { projects: updatedProjects }, { merge: true });
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- ACTIONS ---
  const addProject = () => {
    if (!newProjectName.trim()) return;
    const newList = [...projects, { id: crypto.randomUUID(), name: newProjectName.trim(), tasks: [], bgColor: '' }];
    saveToCloud(newList);
    setNewProjectName('');
  };

  const deleteProject = (projectId: string) => {
    if (!confirm("Are you sure you want to delete this whole list?")) return;
    const newList = projects.filter(p => p.id !== projectId);
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
    const newList = projects.map(p => p.id === projectId ? {
      ...p, tasks: p.tasks.map(t => {
        if (t.id === taskId) {
          const isCompleting = !t.completed;
          return { ...t, completed: isCompleting, completedAt: isCompleting ? new Date().toLocaleDateString() : undefined };
        }
        return t;
      })
    } : p);
    saveToCloud(newList);
  };

  const handleProjectDrop = (targetIndex: number) => {
    if (draggedProjectIndex === null || draggedProjectIndex === targetIndex) return;
    const newList = [...projects];
    const [moved] = newList.splice(draggedProjectIndex, 1);
    newList.splice(targetIndex, 0, moved);
    saveToCloud(newList);
    setDraggedProjectIndex(null);
  };

  const handleTaskDrop = (targetProjectId: string, targetTaskIndex?: number) => {
    if (!draggedTask) return;
    const newList: Project[] = JSON.parse(JSON.stringify(projects));
    const sourceProj = newList.find(p => p.id === draggedTask.pid);
    const destProj = newList.find(p => p.id === targetProjectId);
    if (sourceProj && destProj) {
      const tIndex = sourceProj.tasks.findIndex(t => t.id === draggedTask.tid);
      const [task] = sourceProj.tasks.splice(tIndex, 1);
      if (targetTaskIndex !== undefined) destProj.tasks.splice(targetTaskIndex, 0, task);
      else destProj.tasks.push(task);
      saveToCloud(newList);
    }
    setDraggedTask(null);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`}>
      <div className={`${ACCENT_CLASS_MAP[accent].bg} text-white`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
  <h1 className="text-lg font-semibold tracking-tight">Vapor Lists</h1>
  
  {userEmail ? (
    <button 
      onClick={handleLogout} 
      className="group flex items-center gap-2 text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-all border border-white/10"
    >
      <span className="opacity-70 group-hover:hidden uppercase tracking-widest font-medium">
        {userEmail}
      </span>
      <span className="hidden group-hover:inline uppercase tracking-widest font-bold text-rose-400">
        Sign Out
      </span>
    </button>
  ) : (
    /* Official-style Google Sign-in Button */
    <button 
      onClick={handleGoogleLogin}
      className="flex items-center gap-3 bg-white text-zinc-700 px-3 py-1.5 rounded-md text-[13px] font-medium shadow-sm hover:shadow-md hover:bg-zinc-50 transition-all border border-zinc-200"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.707a5.41 5.41 0 010-3.414V4.961H.957a8.992 8.992 0 000 8.078l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293c.708-2.127 2.692-3.713 5.036-3.713z" fill="#EA4335"/>
      </svg>
      Sign in with Google
    </button>
  )}
</div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => setIsDark(!isDark)} className="text-xl opacity-80 hover:opacity-100">{isDark ? '☀️' : '🌙'}</button>
            <div className="flex gap-2">
              {(Object.keys(ACCENT_CLASS_MAP) as Accent[]).map(color => (
                <button key={color} onClick={() => setAccent(color)} className={`w-5 h-5 rounded-full border-2 transition-all ${accent === color ? 'border-white scale-110' : 'border-transparent opacity-60'} ${ACCENT_CLASS_MAP[color].dot}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'active' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Active</button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'completed' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>
              Completed ({projects.reduce((sum, p) => sum + p.tasks.filter(t => t.completed).length, 0)})
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <button onClick={() => setIsCompact(!isCompact)} className="hover:text-black dark:hover:text-white">{isCompact ? 'Comfortable' : 'Compact'}</button>
            <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800" />
            <button onClick={() => setCollapsed(Object.fromEntries(projects.map(p => [p.id, true])))} className="hover:text-black dark:hover:text-white">Collapse All</button>
            <button onClick={() => setCollapsed({})} className="hover:text-black dark:hover:text-white">Show All</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 max-w-2xl mb-10">
          <input ref={projectInputRef} value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="Create a new list..." className="flex-[2] px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 dark:text-white" />
          <div className="flex-1 relative">
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks..." className="w-full px-4 py-2 pl-9 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
             <span className="absolute left-3 top-2.5 text-xs opacity-40">🔍</span>
          </div>
          <button onClick={addProject} className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-md active:scale-95 ${ACCENT_CLASS_MAP[accent].bg}`}>Add</button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {projects.map((project, pIndex) => {
            const isCollapsed = collapsed[project.id];
            const tasks = project.tasks
              .filter(t => (activeTab === 'active' ? !t.completed : t.completed))
              .filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()) || (t.completedAt?.includes(searchQuery)));
            const progress = project.tasks.length ? (project.tasks.filter(t => t.completed).length / project.tasks.length) * 100 : 0;
            const contrastClass = getContrastColor(project.bgColor);

            if (tasks.length === 0 && searchQuery) return null;
            if (activeTab === 'completed' && project.tasks.filter(t => t.completed).length === 0) return null;

            return (
              <div key={project.id} draggable={!draggedTask} onDragStart={() => setDraggedProjectIndex(pIndex)} onDragOver={e => e.preventDefault()} onDrop={() => draggedProjectIndex !== null ? handleProjectDrop(pIndex) : handleTaskDrop(project.id)} style={{ backgroundColor: project.bgColor || undefined }} className={`group border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg ${!project.bgColor ? 'bg-white dark:bg-zinc-900' : ''} ${isCompact ? 'p-3' : 'p-5'}`}>
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <div className="flex items-center gap-3">
                    <span onClick={() => setCollapsed(prev => ({...prev, [project.id]: !isCollapsed}))} className={`cursor-pointer uppercase tracking-tight ${contrastClass}`}>{project.name}</span>
                    <div className="relative flex items-center justify-center h-7 w-7 rounded-full bg-black/5 dark:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-base pointer-events-none`}>🖌️</span>
                        <input type="color" value={project.bgColor || (isDark ? "#18181b" : "#ffffff")} onChange={(e) => updateProjectColor(project.id, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => deleteProject(project.id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-red-400">🗑️</button>
                    <button onClick={() => setCollapsed(prev => ({...prev, [project.id]: !isCollapsed}))} className={`flex items-center justify-center h-7 w-7 rounded-full bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 transition-all hover:scale-110 active:scale-95`}><span className={`transition-transform duration-300 inline-block text-lg ${isCollapsed ? '' : 'rotate-90'}`}>▸</span></button>
                  </div>
                </div>
                <div className="w-full h-[2px] bg-zinc-100 dark:bg-zinc-800/50 mb-4 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${ACCENT_CLASS_MAP[accent].bg}`} style={{ width: `${progress}%` }} />
                </div>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {tasks.map((task, tIndex) => (
                      <div key={task.id} draggable onDragStart={(e) => { e.stopPropagation(); setDraggedTask({tid: task.id, pid: project.id}); }} onDragOver={e => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); handleTaskDrop(project.id, tIndex); }} className={`flex items-center justify-between text-sm rounded-lg cursor-grab active:cursor-grabbing group/task transition-all ${project.bgColor ? 'bg-black/10' : 'bg-zinc-50 dark:bg-zinc-800'} ${isCompact ? 'px-2 py-2' : 'px-4 py-3'}`}>
                        <div className="flex flex-col">
                            <span className={`${task.completed ? 'line-through opacity-40' : contrastClass}`}>{task.text}</span>
                            {task.completedAt && <span className={`text-[9px] font-bold opacity-30 uppercase mt-0.5 ${contrastClass}`}>Finished: {task.completedAt}</span>}
                        </div>
                        <button onClick={() => toggleTask(project.id, task.id)} className="text-[10px] font-bold text-emerald-500 opacity-0 group-hover/task:opacity-100 transition-opacity">{task.completed ? 'UNDO' : 'DONE'}</button>
                      </div>
                    ))}
                    {activeTab === 'active' && <input placeholder="Add task..." className={`w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 focus:outline-none transition-all py-2 text-sm ${contrastClass} placeholder:opacity-40`} onKeyDown={e => { if (e.key === 'Enter') { addTask(project.id, e.currentTarget.value); e.currentTarget.value = ''; } }} />}
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