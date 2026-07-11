import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC1HMoF_x77d96abxnb2z81JIyAjht5cr8",
  authDomain: "bank-17d30.firebaseapp.com",
  projectId: "bank-17d30",
  storageBucket: "bank-17d30.firebasestorage.app",
  messagingSenderId: "274927942892",
  appId: "1:274927942892:web:d8c2567709c2e166f779c9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
