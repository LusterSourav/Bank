import{initializeApp}from 'firebase/app';

import{getAuth,GoogleAuthProvider}from 'firebase/auth';

// Firebase config from env vars — resolves GitHub secret scanning alert
const firebaseConfig ={
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID.trim(),
};

const app=initializeApp(firebaseConfig);
export const auth =getAuth(app);
export const googleProvider= new GoogleAuthProvider();
