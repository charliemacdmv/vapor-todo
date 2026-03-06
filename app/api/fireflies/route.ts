import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Fireflies Payload:", JSON.stringify(body)); // Helps us debug in Vercel logs

    // 1. IMPROVED TITLE LOGIC
    // Tries meeting_title, then title, then defaults to "Meeting Note"
    const title = body.meeting_title || body.title || "Meeting Note";

    // 2. IMPROVED TASK LOGIC
    // Fireflies sometimes sends 'action_items', sometimes 'content', or a nested 'transcript'
    let rawTasks = [];
    if (body.action_items && Array.isArray(body.action_items)) {
      rawTasks = body.action_items;
    } else if (body.transcript?.action_items) {
      rawTasks = body.transcript.action_items;
    } else if (body.summary?.action_items) {
      rawTasks = body.summary.action_items;
    }

    // YOUR EMAIL (Ensure this is your Microsoft/Vapor email)
    const MY_EMAIL = "charliemacdmv@gmail.com"; 

    const listId = Math.random().toString(36).substring(7);
    
    await db.collection('projects').doc(listId).set({
      name: `📅 ${title.toUpperCase()}`,
      tasks: rawTasks.map((item: any) => {
        // If it's a string, use it. If it's an object, try to find 'text' or 'content'
        const taskText = typeof item === 'string' 
          ? item 
          : (item.text || item.content || "New Task");

        return {
          id: Math.random().toString(36).substring(7),
          text: taskText,
          completed: false
        };
      }),
      bgColor: '#1e293b',
      isCompleted: false,
      ownerId: "fireflies-sync",
      allowedEmails: [MY_EMAIL],
      sharedWith: [],
      order: -1
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}