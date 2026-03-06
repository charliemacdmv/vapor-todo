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
    const meetingId = body.meetingId || body.id;
    
    // 1. THE SAFETY WAIT
    // We wait 10 seconds to give the Fireflies AI time to finish the summary
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. FETCH THE REAL DATA
    // We don't trust the webhook body; we ask Fireflies for the latest version of this meeting
    const response = await fetch(`https://api.fireflies.ai/graphql`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 65ea307e-9c63-43ec-b80b-ca51bc547e6c` // <--- GET THIS FROM FIREFLIES SETTINGS
      },
      body: JSON.stringify({
          query: `query {
            transcript(id: "${meetingId}") {
              title
              summary {
                action_items
              }
            }
          }`
      })
    });

    const { data } = await response.json();
    const transcript = data?.transcript;

    if (!transcript) throw new Error("Could not fetch transcript data");

    const title = (transcript.title || "New Meeting").toUpperCase();
    const rawTasks = transcript.summary?.action_items || [];

    // 3. SYNC TO VAPOR
    const MY_EMAIL = "charliemacdmv@gmail.com";
    const listId = Math.random().toString(36).substring(7);
    
    await db.collection('projects').doc(listId).set({
      name: `📅 ${title}`,
      tasks: rawTasks.map((text: string) => ({
        id: Math.random().toString(36).substring(7),
        text: text,
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