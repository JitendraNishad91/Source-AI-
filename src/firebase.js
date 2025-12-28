import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAlPvW2LBENz4ZJz2I9fZxfpi8H5-bASdY",
  authDomain: "open-ai-7b92d.firebaseapp.com",
  projectId: "open-ai-7b92d",
  storageBucket: "open-ai-7b92d.firebasestorage.app",
  messagingSenderId: "512071967882",
  appId: "1:512071967882:web:218060e148faaa95ff3973",
  measurementId: "G-ZR3X5Y16PG"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db  cx= getFirestore(app);

export { app, auth, db, analytics };
export default app;