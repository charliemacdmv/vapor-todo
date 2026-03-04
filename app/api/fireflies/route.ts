import { NextResponse } from 'next/server';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Use your existing config
const firebaseConfig = {
  apiKey: "AIzaSyDhHHzBrFUWyudcVDfwKliG5gM10WmDIFM",
  authDomain: "vapor-todo-list.firebaseapp.com",
  projectId: "vapor-todo-list",
  storageBucket: "vapor-todo-list.firebasestorage.app",
  messagingSenderId: "996487428121",
  appId: "1:996487428121:web:ebab0c6fb09ec11d815288"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Fireflies sends the meeting name and summary action items
    const meetingTitle = data.title || "New Meeting Tasks";
    const actionItems = data.summary?.action_items || [];

    if (actionItems.length === 0) {
      return NextResponse.json({ message: "No action items found" }, { status: 200 });
    }

    const projectId = crypto.randomUUID();
    
    // Format tasks for your UI
    const tasks = actionItems.map((item: string) => ({
      id: crypto.randomUUID(),
      text: item,
      completed: false
    }));

    // Save to the 'projects' collection
    await setDoc(doc(db, "projects", projectId), {
      name: `📅 ${meetingTitle}`,
      tasks: tasks,
      ownerId: "SYSTEM_FIREFLIES", // Marks this as an AI-generated list
      allowedEmails: ["charles.mchenry@automatedrt.com"], // Your email from the screenshot
      bgColor: "#4f46e5", // Indigo theme
      isCompleted: false,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}