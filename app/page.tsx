'use client';

import { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, doc, onSnapshot, setDoc, collection, 
  query, where, deleteDoc, updateDoc, arrayUnion, orderBy, writeBatch 
} from "firebase/firestore";
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signOut 
} from "firebase/auth";

// DnD Kit
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

type Accent = 'gray' | 'indigo' | 'violet' | 'fuchsia' | 'rose' | 'amber' | 'emerald' | 'teal' | 'cyan' | 'lime';
const ACCENT_CLASS_MAP: Record<Accent, string> = {
  gray: 'bg-zinc-600', indigo: 'bg-indigo-600', violet: 'bg-violet-600', fuchsia: 'bg-fuchsia-600',
  rose: 'bg-rose-600', amber: 'bg-amber-600', emerald: 'bg-emerald-600', teal: 'bg-teal-600',
  cyan: 'bg-cyan-600', lime: 'bg-lime-600'
};

function SortableProject({ id, children }: { id: string, children: (props: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.6 : 1 };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners })}</div>;
}

interface Task { id: string; text: string; completed: boolean; completedAt?: string; }
interface Project { 
  id: string; name: string; tasks: Task[]; bgColor?: string; 
  isCompleted?: boolean; ownerId: string; allowedEmails: string[]; sharedWith?: {email: string}[]; order: number; 
}

const getContrastColor = (hex?: string) => {
  if (!hex) return 'text-zinc-900 dark:text-zinc-100';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? 'text-zinc-900' : 'text-white';
};

export default function ProductivityApp() {
  const [hasMounted, setHasMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [accent, setAccent] = useState<Accent>('indigo');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    setHasMounted(true);
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid); setUserEmail(user.email); setUserPhoto(user.photoURL);
        const q = query(collection(db, "projects"), where("allowedEmails", "array-contains", user.email || user.uid), orderBy("order", "asc"));
        const unsubProjects = onSnapshot(q, (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() } as Project))));
        onSnapshot(doc(db, "users", user.uid), (d) => { if (d.exists() && d.data().accent) setAccent(d.data().accent); });
        return () => unsubProjects();
      } else { signInAnonymously(auth); }
    });
    return () => unsubAuth();
  }, []);

  const toggleTask = async (project: Project, taskId: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedTasks = project.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, completed: !t.completed, completedAt: !t.completed ? timestamp : undefined };
      }
      return t;
    });
    await updateDoc(doc(db, "projects", project.id), { tasks: updatedTasks });
  };

  const addProject = async () => {
    if (!newProjectName.trim() || !userId) return;
    const id = Math.random().toString(36).substring(7);
    await setDoc(doc(db, "projects", id), { name: newProjectName.trim(), tasks: [], bgColor: '', isCompleted: false, ownerId: userId, allowedEmails: [userEmail || userId], sharedWith: [], order: projects.length });
    setNewProjectName('');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id), newIndex = projects.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(projects, oldIndex, newIndex);
    setProjects(reordered);
    const batch = writeBatch(db);
    reordered.forEach((p, idx) => batch.update(doc(db, "projects", p.id), { order: idx }));
    await batch.commit();
  };

  const saveTaskEdit = async (projectId: string, tasks: Task[], taskId: string, newText: string) => {
    setEditingTaskId(null);
    if (!newText.trim()) return;
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, text: newText.trim() } : t);
    await updateDoc(doc(db, "projects", projectId), { tasks: updatedTasks });
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === 'active') {
        const hasActiveTasks = project.tasks.length === 0 || project.tasks.some(t => !t.completed);
        return !project.isCompleted && hasActiveTasks;
      } else {
        const hasCompletedTasks = project.tasks.some(t => t.completed);
        return project.isCompleted || hasCompletedTasks;
      }
    });
  }, [projects, searchQuery, activeTab]);

  if (!hasMounted) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* HEADER */}
      <div className={`${ACCENT_CLASS_MAP[accent]} text-white px-6 py-2 flex justify-between items-center shadow-md`}>
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold italic uppercase tracking-tighter">Vapor</h1>
          {userEmail && (
            <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded-full border border-white/10">
              {userPhoto ? (
                <img src={userPhoto} className="w-5 h-5 rounded-full border border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] font-bold">{userEmail[0].toUpperCase()}</div>
              )}
              <span className="text-[9px] font-bold uppercase">{userEmail.split('@')[0]}</span>
              <button onClick={() => signOut(auth)} className="text-[8px] font-bold text-rose-300 ml-1">EXIT</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 bg-black/10 p-1 rounded-full border border-white/10">
            {(Object.keys(ACCENT_CLASS_MAP) as Accent[]).map(color => (
              <button key={color} onClick={() => { setAccent(color); if (userId) setDoc(doc(db, "users", userId), { accent: color }, { merge: true }); }} className={`w-3 h-3 rounded-full border ${accent === color ? 'border-white scale-110' : 'border-transparent opacity-50'} ${ACCENT_CLASS_MAP[color]} transition-all`} />
            ))}
          </div>
          <button onClick={() => setIsDark(!isDark)} className="text-sm">{isDark ? '☀️' : '🌙'}</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md ${activeTab === 'active' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Active</button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md ${activeTab === 'completed' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Archive</button>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="SEARCH..." className="px-3 py-1.5 text-[11px] font-bold rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-transparent outline-none w-40" />
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="NEW LIST..." className="px-3 py-1.5 text-[11px] font-bold rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-transparent outline-none w-40" />
            <button onClick={addProject} className={`${ACCENT_CLASS_MAP[accent]} px-4 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-lg`}>ADD</button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredProjects.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
              {filteredProjects.map((project) => {
                const contrast = getContrastColor(project.bgColor);
                const displayTasks = project.tasks.filter(t => activeTab === 'active' ? !t.completed : t.completed);

                return (
                  <SortableProject key={project.id} id={project.id}>
                    {({ attributes, listeners }: any) => (
                      <div style={{ backgroundColor: project.bgColor || undefined }} className={`group border-2 border-zinc-100 dark:border-zinc-800/50 rounded-xl transition-all ${!project.bgColor ? 'bg-white dark:bg-zinc-900' : ''} p-3`}>
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex flex-col gap-1 truncate w-[60%]">
                            <span {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing uppercase text-[14px] font-bold truncate ${contrast}`}>{project.name}</span>
                            <div className="flex -space-x-1">
                              {project.sharedWith?.map((sw, i) => <div key={i} className="w-3.5 h-3.5 rounded-full bg-zinc-700 border border-black/10 text-[6px] flex items-center justify-center text-white" title={sw.email}>{sw.email[0].toUpperCase()}</div>)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {const e = prompt("Email:"); if(e) updateDoc(doc(db,"projects",project.id),{allowedEmails:arrayUnion(e.toLowerCase()),sharedWith:arrayUnion({email:e.toLowerCase()})})}} className={`text-[10px] ${contrast}`}>👤</button>
                            <div className="relative w-4 h-4 flex items-center justify-center">
                               <span className={`text-[11px] ${contrast}`}>🎨</span>
                               <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={(e) => updateDoc(doc(db, "projects", project.id), { bgColor: e.target.value })} />
                            </div>
                            <button onClick={() => updateDoc(doc(db, "projects", project.id), { isCompleted: !project.isCompleted })} className={`text-[11px] ${contrast}`}>
                              {project.isCompleted ? '♻️' : '✅'}
                            </button>
                            <button onClick={() => confirm("Delete entire list?") && deleteDoc(doc(db,"projects",project.id))} className="text-rose-500 text-[11px]">🗑️</button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {displayTasks.map((task) => (
                            <div key={task.id} className={`flex items-start justify-between rounded-md p-1.5 ${project.bgColor ? 'bg-black/10' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                              {editingTaskId === task.id ? (
                                <textarea autoFocus rows={2} className={`text-[12px] font-bold bg-transparent border-none outline-none flex-grow ${contrast} resize-none`} defaultValue={task.text} onBlur={(e) => saveTaskEdit(project.id, project.tasks, task.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTaskEdit(project.id, project.tasks, task.id, e.currentTarget.value)} />
                              ) : (
                                <div className="flex flex-col flex-grow pr-2">
                                  <span onClick={() => setEditingTaskId(task.id)} className={`text-[12px] font-bold leading-tight cursor-text whitespace-normal break-words ${task.completed ? 'line-through opacity-30' : contrast}`}>
                                    {task.text}
                                  </span>
                                  {task.completedAt && (
                                    <span className="text-[7px] font-black uppercase opacity-40 mt-0.5 tracking-wider">Archived {task.completedAt}</span>
                                  )}
                                </div>
                              )}
                              <button onClick={() => toggleTask(project, task.id)} className={`text-[9px] font-bold flex-shrink-0 ml-1 mt-0.5 ${task.completed ? 'text-zinc-400' : 'text-emerald-500'}`}>{task.completed ? 'UNDO' : 'DONE'}</button>
                            </div>
                          ))}
                          {activeTab === 'active' && (
                            <input placeholder="ADD..." className={`w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 py-1 text-[11px] font-bold ${contrast} outline-none opacity-40 focus:opacity-100`} onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { updateDoc(doc(db,"projects",project.id),{tasks:[...project.tasks,{id:Math.random().toString(36).substring(7),text:e.currentTarget.value,completed:false}]}); e.currentTarget.value = ''; } }} />
                          )}
                        </div>
                      </div>
                    )}
                  </SortableProject>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}