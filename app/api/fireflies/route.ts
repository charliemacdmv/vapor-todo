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
    
    // Fireflies sends 'title' and 'action_items'
    const title = body.title || "New Meeting";
    const action_items = body.action_items || [];

    const MY_EMAIL = "charliemacdmv@gmail.com"; // MUST BE YOUR LOGIN EMAIL

    const listId = Math.random().toString(36).substring(7);
    
    await db.collection('projects').doc(listId).set({
      name: `📅 ${title.toUpperCase()}`,
      tasks: action_items.map((text: string) => ({
        id: Math.random().toString(36).substring(7),
        text,
        completed: false
      })),
      bgColor: '#1e293b',
      isCompleted: false,
      ownerId: "fireflies-sync",
      allowedEmails: [MY_EMAIL],
      sharedWith: [],
      order: -1
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}