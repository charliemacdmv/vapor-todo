import { NextResponse } from 'next/server';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
    const body = await request.json();
    const meetingId = body.meetingId || body.id;
    
    let title = body.meeting_title || body.title || "New Meeting";
    let tasks = body.action_items || [];

    // 1. THE RECOVERY: If tasks are empty, wait and pull from API
    if (tasks.length === 0 && meetingId) {
      console.log("Waiting 15s for AI summary...");
      await new Promise(resolve => setTimeout(resolve, 15000));

      const firefliesRes = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 65ea307e-9c63-43ec-b80b-ca51bc547e6c` // <--- PASTE YOUR KEY HERE
        },
        body: JSON.stringify({
          query: `query Transcript($transcriptId: String!) {
            transcript(id: $transcriptId) {
              title
              summary { action_items }
            }
          }`,
          variables: { transcriptId: meetingId }
        })
      });

      const resJson = await firefliesRes.json();
      const transcript = resJson.data?.transcript;
      if (transcript) {
        title = transcript.title || title;
        tasks = transcript.summary?.action_items || [];
      }
    }

    // 2. THE SYNC: Using your specific email to ensure it shows up for you
    const MY_EMAIL = "charliemacdmv@gmail.com"; 
    const listId = Math.random().toString(36).substring(7);

    await setDoc(doc(db, "projects", listId), {
      name: `📅 ${title.toUpperCase()}`,
      tasks: tasks.map((t: any) => ({
        id: Math.random().toString(36).substring(7),
        text: typeof t === 'string' ? t : (t.content || "Action Item"),
        completed: false
      })),
      bgColor: '#1e293b',
      isCompleted: false,
      ownerId: "fireflies-sync",
      allowedEmails: [MY_EMAIL],
      sharedWith: [],
      order: -1
    });

    return NextResponse.json({ success: true, count: tasks.length });
  } catch (error: any) {
    console.error("Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}