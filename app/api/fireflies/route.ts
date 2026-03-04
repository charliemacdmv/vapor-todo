import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDhHHzBrFUWyudcVDfwKliG5gM10WmDIFM",
  authDomain: "vapor-todo-list.firebaseapp.com",
  projectId: "vapor-todo-list",
  storageBucket: "vapor-todo-list.firebasestorage.app",
  messagingSenderId: "996487428121",
  appId: "1:996487428121:web:ebab0c6fb09ec11d815288",
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// Simple ID generator to avoid the 'crypto' unknown error
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 1. Naming the List: Prefixes with a calendar icon and converts to Uppercase
    // Fireflies usually sends 'title' or 'meeting_title'
    const rawTitle = data.title || data.meeting_title || "New Meeting Note";
    const listName = `📅 ${rawTitle.toUpperCase()}`;
    
    // 2. Generating the Tasks
    // Fireflies sends 'action_items' as an array of strings
    const actionItems = data.action_items || [];
    const tasks = actionItems.map((item: string) => ({
      id: generateId(),
      text: item,
      completed: false
    }));

    // 3. Save to Firestore
    const projectId = generateId();
    await setDoc(doc(db, "projects", projectId), {
      name: listName,
      tasks: tasks,
      bgColor: '#1e293b', // Slate background for meeting notes
      isCompleted: false,
      ownerId: "fireflies-integration",
      allowedEmails: ["charles.mchenry@automatedrt.com"], // IMPORTANT: Put your login email here!
      order: -1 // This forces it to the top of your list
    });

    return NextResponse.json({ success: true, listId: projectId });
  } catch (error: any) {
    console.error("Fireflies Webhook Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}